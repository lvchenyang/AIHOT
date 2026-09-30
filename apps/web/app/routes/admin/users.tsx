import { useState, type FormEvent } from "react";
import { Form, useSearchParams } from "react-router";
import type { Route } from "./+types/users";
import type { MemberList, MemberUser } from "@aihot/contracts/members";
import { SITE } from "@aihot/industry/site";
import { adminGet } from "../../lib/admin.server";
import { useAdminAction } from "../../features/admin/action";
import { AdminPage, Badge, Button, Card, DataTable, FilterChips, Input, Pager, Time } from "../../features/admin/ui";

export function loader({ request }: Route.LoaderArgs) {
  return adminGet<MemberList>(request, `/api/admin/users${new URL(request.url).search}`);
}
export const meta: Route.MetaFunction = () => [{ title: `用户管理 · ${SITE.name} 后台` }];
export const headers: Route.HeadersFunction = () => ({ "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" });

export default function Users({ loaderData: { rows, page, hasMore } }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const { run, busy } = useAdminAction();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MemberUser | null>(null);
  const [resetting, setResetting] = useState<MemberUser | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const result = await run("POST", "/api/admin/users", { username: values.get("username"), displayName: values.get("displayName"), password: values.get("password") }, { success: "账号已创建" });
    if (result) { form.reset(); setCreateOpen(false); }
  }
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const values = new FormData(event.currentTarget);
    const result = await run("PATCH", `/api/admin/users/${editing.id}`, { displayName: values.get("displayName"), enabled: values.get("enabled") === "on" }, { success: "用户信息已保存" });
    if (result) setEditing(null);
  }
  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetting) return;
    const form = event.currentTarget;
    const password = new FormData(form).get("password");
    const result = await run("POST", `/api/admin/users/${resetting.id}/password`, { password }, { success: "密码已重置，用户需要重新登录" });
    if (result) { form.reset(); setResetting(null); }
  }
  const label = "block space-y-1.5 text-[13px] font-medium text-ink-2";
  return (
    <AdminPage title="用户管理" subtitle="账号由管理员创建。可编辑用户名称、停用账号或重置密码。" actions={<Button tone="primary" disabled={busy} onClick={() => { setCreateOpen(!createOpen); setEditing(null); setResetting(null); }}>{createOpen ? "收起新建" : "新建用户"}</Button>}>
      {createOpen && <Card title="新建用户" className="mb-5">
        <form onSubmit={create} className="max-w-xl space-y-4">
          <label className={label}>账号<Input name="username" autoComplete="off" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32} pattern="[a-zA-Z0-9][a-zA-Z0-9_.\-]{2,31}" /></label>
          <p className="text-[12px] text-ink-4">3–32 位字母、数字、点、下划线或短横线，以字母或数字开头，不区分大小写。账号创建后不可修改。</p>
          <label className={label}>名称<Input name="displayName" autoComplete="off" required maxLength={80} /></label>
          <label className={label}>初始密码<Input name="password" type="password" autoComplete="new-password" required minLength={8} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,128}" maxLength={128} /></label>
          <p className="text-[12px] text-ink-4">密码需要 8–128 个字符，且同时包含字母和数字。创建后请将账号和初始密码交给用户；用户可以在“我的账号”修改密码。</p>
          <Button type="submit" tone="primary" busy={busy}>创建账号</Button>
        </form>
      </Card>}
      {editing && <Card title={`编辑用户 · ${editing.username}`} className="mb-5">
        <form key={editing.id} onSubmit={update} className="max-w-xl space-y-4">
          <label className={label}>名称<Input name="displayName" defaultValue={editing.displayName} required maxLength={80} /></label>
          <label className="flex items-center gap-2 text-[13px]"><input name="enabled" type="checkbox" defaultChecked={editing.enabled} />允许登录</label>
          <p className="text-[12px] text-ink-4">取消“允许登录”后，用户会退出所有设备，直到账号重新启用。</p>
          <div className="flex gap-2"><Button type="submit" tone="primary" busy={busy}>保存修改</Button><Button disabled={busy} onClick={() => setEditing(null)}>取消</Button></div>
        </form>
      </Card>}
      {resetting && <Card title={`重置密码 · ${resetting.username}`} className="mb-5">
        <form key={resetting.id} onSubmit={resetPassword} className="max-w-xl space-y-4">
          <label className={label}>新密码<Input name="password" type="password" autoComplete="new-password" required minLength={8} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,128}" maxLength={128} /></label>
          <p className="text-[12px] text-ink-4">密码需要 8–128 个字符，且同时包含字母和数字。重置后，用户会退出所有设备，请将新密码交给用户。</p>
          <div className="flex gap-2"><Button type="submit" tone="primary" busy={busy}>确认重置密码</Button><Button disabled={busy} onClick={() => setResetting(null)}>取消</Button></div>
        </form>
      </Card>}
      <Card pad={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-3">
          <Form method="get" className="flex w-full max-w-sm gap-2">
            {params.get("enabled") && <input type="hidden" name="enabled" value={params.get("enabled")!} />}
            <Input name="q" defaultValue={params.get("q") ?? ""} placeholder="搜索账号或名称" aria-label="搜索用户" maxLength={80} />
            <Button type="submit">搜索</Button>
          </Form>
          <FilterChips param="enabled" options={[{ value: "", label: "全部" }, { value: "true", label: "已启用" }, { value: "false", label: "已停用" }]} />
        </div>
        <DataTable rows={rows} rowKey={(user) => user.id} empty="没有找到用户。可以新建账号或调整搜索条件。" columns={[
          { key: "username", label: "账号", render: (user) => <span className="font-medium text-ink">{user.username}</span> },
          { key: "name", label: "名称", render: (user) => user.displayName },
          { key: "enabled", label: "状态", render: (user) => <Badge tone={user.enabled ? "ok" : "muted"}>{user.enabled ? "已启用" : "已停用"}</Badge> },
          { key: "created", label: "创建时间", render: (user) => <Time at={user.createdAt} /> },
          { key: "login", label: "最近登录", render: (user) => user.lastLoginAt ? <Time at={user.lastLoginAt} /> : "尚未登录" },
          { key: "actions", label: "操作", render: (user) => <div className="flex gap-1">
            <Button size="sm" disabled={busy} onClick={() => { setEditing(user); setResetting(null); setCreateOpen(false); }}>编辑</Button>
            <Button size="sm" disabled={busy} onClick={() => { setResetting(user); setEditing(null); setCreateOpen(false); }}>重置密码</Button>
          </div> },
        ]} />
      </Card>
      <Pager page={page} hasMore={hasMore} />
    </AdminPage>
  );
}
