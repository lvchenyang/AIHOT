# 普通用户账号

普通用户通过账号、密码登录。账号由管理员创建，不提供公开注册。登录成功后进入 `/` 首页；资讯、RSS、公开 API 和 MCP 继续匿名可读，现有采集、评分、写作和发布逻辑不变。

## 使用

1. 管理员通过原来的 `/admin/login` 登录，在“系统 → 用户管理”创建账号。
2. 填写账号、名称和初始密码。账号为 3–32 位字母、数字、点、下划线或短横线，以字母或数字开头，不区分大小写；名称最多 80 个字符；密码为 12–128 个字符。
3. 将账号和初始密码交给用户。用户打开 `/login` 登录，成功后回到首页。
4. 桌面导航及手机“更多”中的“我的账号”指向 `/account`，可修改密码和退出登录。修改密码需要当前密码，成功后所有设备退出，重新登录后回首页。

后台 `/admin/users` 支持按账号或名称搜索、按状态筛选、分页、编辑名称、启用／停用和重置密码。账号创建后不可修改。停用和重置密码会删除该用户全部会话，重新启用不会恢复旧会话。首版不提供账号删除。

## 实现边界

- 增量迁移：`database/migrations/0039_member_accounts.sql`，新增 `member_users`、`member_sessions`、`member_login_limits`，不修改已有表。
- 后端：`packages/backend/src/members/`；新增路由分别位于 `apps/api/src/routes/members.ts` 和 `admin-users.ts`。
- 原 API 启动文件只注册新路由。原 Web 路由表和导航只增加入口。管理员登录、公开读取层、worker 业务保持原样。
- 前端通过 HTTP 获取账号数据，不接触数据库或密码哈希。
- 普通用户 Cookie、用户表和会话与管理员独立。管理员身份不会自动成为普通用户身份，普通账号也无法进入后台。
- 新增私有 API 使用 `memberHandler`，新增私有页面的每个 loader 使用 `requireMember`，并设置 `private, no-store`。不要仅依赖父级页面或隐藏按钮保护数据。
- 首页保持公开缓存，导航中的“我的账号”是固定入口，不把用户身份写入公开 HTML。

## 登录和存储

密码用 Node 内置异步 scrypt，加独立随机盐，参数为 N=131072、r=8、p=1。参数依据 [OWASP 密码存储建议](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt)。不保存或回传明文密码。

会话有效期为 7 天，Cookie 为 HttpOnly、SameSite=Lax；`SITE_URL` 为 HTTPS 时启用 Secure。数据库只保存会话令牌的 SHA-256 摘要。登录会替换当前浏览器旧会话；过期会话在后续登录时清理。

普通用户登录、改密和退出请求检查 Origin；改密和退出还需要会话 CSRF 令牌。部署时务必把 `SITE_URL` 配成浏览器实际访问的地址（包含端口）。后台用户管理复用现有管理员会话和 CSRF 校验。

登录尝试采用数据库共享的 15 分钟窗口，每个账号最多 10 次、每个 IP 最多 20 次、全站最多 100 次，成功和失败均计数。修改密码使用相同上限的独立窗口。接口返回 429 后等待窗口结束；API 重启不会清空计数。过期计数在后续尝试时清理。

账号创建、编辑、密码重置、用户登录及改密写入现有审计表，记录操作者与用户编号，不记录密码、密码哈希或会话令牌。初始密码由管理员自行交付，本功能不发送短信、邮件或其他外部通知。

上线前，运营者需要按实际账号用途和保存期限确认隐私说明；本次不替运营者修改 `industry/pages/` 的条款内容。

## 验证

使用 Node.js 24 和新建的空测试数据库（库名以 `_test` 或 `_ci` 结尾）。采集、模型调用、飞书推送及 IndexNow 均保持关闭。

```bash
DATABASE_URL=postgres://127.0.0.1:5432/disonhot_test node scripts/migrate.ts
npm run typecheck
DATABASE_URL=postgres://127.0.0.1:5432/disonhot_test npm test
npm run build -w @aihot/web
node --test apps/web/tests/*.test.ts
node scripts/smoke.ts --base http://localhost:3000
```

`tests/members.test.ts` 覆盖管理员权限与 CSRF、用户创建和搜索分页、密码存储和审计、登录及角色隔离、停用／重置／改密后的会话撤销、退出、过期和跨进程限流。Web 缓存测试覆盖账号页 HTML 和 React Router 数据请求的登录保护及缓存隔离。

本次本地验证（2026-09-30）：类型检查、前端构建、14 项 Web 测试、32 项站点冒烟检查通过。浏览器已验证后台建号、编辑、刷新后数据保留、普通用户登录回首页，以及停用账号后刷新账户页回到登录页。

安全阀全关时，完整后端测试存在 27 项原有模型相关失败；用未修改的 HEAD 和另一个新建空库对照，失败项目完全相同。本次新增账号测试通过，没有增加原有测试的失败项。测试数据库和预览服务独立于现有部署，尚未向现有站点数据库应用本迁移。
