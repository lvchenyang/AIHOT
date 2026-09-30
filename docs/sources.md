# 信源

信源在后台“信源”页管理：新建、试抓一次看看抓到什么、改频率、启停、看失败原因和最近的条目。首次启动时，`industry/sources.json` 里的示范信源会被导入。

## 六种信源

| 类型 | 适合 | 需要 |
|---|---|---|
| `rss` | 有 RSS / Atom 的博客、媒体、Substack、公众号转 RSS 服务 | 无 |
| `web_list` | 没有 RSS 的网页列表（新闻页、博客列表、更新日志） | 写选择器；抓不到时可以经 Jina Reader 渲染（按次计费） |
| `json_list` | 返回 JSON 的接口（GitHub Releases 等） | 写字段路径 |
| `x_search` | X（推特）账号 | SocialData 的 key，按请求计费 |
| `mp_account` | 微信公众号 | 极致了（Dajiala）的 key，按请求计费 |
| `external` | 你自己的脚本推送进来的内容 | `INGEST_TOKEN`，见下文 |

每种信源认哪些配置项写在 `packages/backend/src/sources/config-keys.ts`。填了不认识的配置项，保存会被拒绝、抓取会直接失败并在后台显示原因，不会悄悄退回通用解析。

### rss

```json
{ "feedUrl": "https://example.com/feed.xml" }
```

可选：`summaryIsBody`（订阅里的摘要就是全文）、`allowCategories` / `denyCategories`（按订阅里的分类过滤）。

### web_list

```json
{
  "url": "https://example.com/news",
  "itemSelector": "article",
  "linkSelector": "a",
  "titleSelector": "h2",
  "publishedAtSelector": "time"
}
```

- `parseMode`：`html`（默认，用选择器）、`markdown`（经 Jina 渲染后按 Markdown 读）、`docusaurus_changelog`。
- `detail`：列表缺日期、标题或摘要时抓详情页补齐（`publishedAtSelector`、`titleSelector`、`summarySelector` 等）。
- `allowUrlPrefixes` / `denyUrlPrefixes`：只收某些路径下的文章。

### 正文裁剪与 Markdown

`rss`、`web_list`、`json_list` 抓取文章详情时，可用 `body` 指定正文区域及需要去掉的区域：

```json
{
  "body": {
    "selector": ".article-content",
    "removeSelectors": [".share-tools", ".related-news"]
  }
}
```

`selector` 必须匹配唯一的正文容器；找不到、匹配多处或内容为空时，正文记为未确认，不退回整页。`removeSelectors` 在正文区域内生效。不配置 `selector` 时，继续使用 Readability；导航、面包屑等明确的页面组件会提前移除。需要 Jina 兜底时，有裁剪规则的信源请求渲染后的 HTML，再执行同一套选择器。

抽取结果先转为 Markdown，再生成站内和 RSS 使用的安全 HTML。标题、段落、列表、引用、链接、图片及普通表格会保留；合并单元格、没有表头的表格、上标和下标在 Markdown 内保留安全 HTML，避免破坏原文含义。详情页“更多操作 → 下载 Markdown”导出同一份清理后的内容，仍受全文展示权限限制。

明确指定正文容器后，纯图片公告和短公告也可保留，不再要求 200 个文字字符。图片以 Markdown 图片引用保留，不等于已识别成文字表格。上海石油天然气交易中心的示范配置使用 `.center_content`，适用于公告正文，不包含站点菜单和页脚。

已有信源需在后台保存 `body` 配置（种子导入不会覆盖已有配置），已有文章需在“内容 → 正文与修订 → 重新抽取正文”重新处理。新正文会形成修订并进入后续分析；只改配置或刷新页面不会更新历史正文。

### 图片与 Vision 模型

默认模型需要同时具备图片输入能力并设置 `LLM_VISION=true`。预筛、评分、结构抽取、内容理解和普通摘要都会向明确支持 Vision 的模型附带正文图片；每次分析最多读取前 4 张，按正文顺序去重，使用最大宽度 1600 像素的阅读图片，而非缩略图。图片下载在同次分析的各步骤之间复用，模型请求仍分别经过回执和预算限制；回执 `request.imageCount` 可核对实际发送的图片数。

图片下载失败、模型不支持图片或超过 4 张的部分均不能当作已读材料。只有图片而没有可用文本、且图片无法传入写作模型时，不凭标题生成摘要。模型拒绝图片时保留分析失败，供后台检查，不自动假装已读全文。Vision 摘要并不会把图片自动转录成 Markdown 文字表格；需要全文转录时应另做识别与核对。

### x_search

```json
{ "query": "from:SomeAccount -filter:replies" }
```

普通账号会被自动合并成一次搜索（每次最多二十几个账号），省请求数。

### mp_account

```json
{ "ghid": "gh_xxxxxxxx", "nickname": "公众号名称" }
```

每个公众号按它的抓取间隔检查一次（查列表按次计费），新文章的正文一并取回。

## 分级、参与方式与全文

- **分级** `tier`：`T1` 官方一手（官网、官方博客、机构）、`T1_5` 官方账号与准官方创作者、`T2` 媒体与个人、`EXCLUDE_MP` 不参与精选。入选门槛按分级不同（`industry/selection.ts`）。
- **参与方式** `participation_mode`：`editorial` 进精选和全部动态；`hot_signal` 不单独展示，只作为“大家在讨论什么”的热度证据；`isolated` 不进任何公开页面。
- **一手** `first_party`：来源是当事方自己。事件页会优先展示一手报道。
- **全文**：`site_fulltext` 决定站内能不能显示全文，`syndicate_fulltext` 决定全文 RSS 能不能带正文。两者**默认都关**，只显示摘要和原文链接；来源明确允许时再打开。公众号、付费墙内容不会因为技术上抓得到就获得全文展示。

## 抓取频率

每个信源有自己的抓取间隔。每天 04:20 会按近 7 天的产出自动调整：产出多的抓得勤，最短 15 分钟；免费信源最长 60 分钟，按次计费的信源最长 120–180 分钟。

抓取失败不推进位置，下次从同一处继续；连续失败的信源在后台标红，每周一会在运营群发一份信源周报（配置了飞书内部群时）。

## 规则：旧文不刷屏

首次发现时原文已经发布超过 48 小时的资料、新信源第一次导入的存量条目、标记为回灌的推送，都按原文时间归档：不进入“今天”，也不推送。这条规则所有入口共用，防止一次性导入历史内容刷屏。

## 外部推送接口

自己写脚本抓的内容，可以推进站里，走和普通采集一样的判重、精选和归组。

```
POST /api/ingest/items
Authorization: Bearer <INGEST_TOKEN>
Content-Type: application/json

{
  "sourceId": "my-crawler",
  "sourceName": "我的抓取脚本",
  "items": [
    { "title": "必填", "url": "必填", "publishedAt": "2026-10-01T08:00:00+08:00", "author": "可选" }
  ]
}
```

- `INGEST_TOKEN` 在 `.env` 里设置，至少 16 位；不设置时接口一律返回 401。
- 每次最多 50 条；每个客户端每分钟最多 10 次。
- 返回 `{"ok": true, "created": <新建条数>}`。缺标题或网址的条目会被跳过，同一请求里重复的网址只取第一条。
- `sourceId` 不存在时会自动建一个 `external` 信源，默认不进公开页面：到后台把它的参与方式改成 `editorial` 才会出现在站上。
- 条目的 `raw._aihot.backfill` 为 `true` 时按历史回灌处理（不进入“今天”、不推送）。
