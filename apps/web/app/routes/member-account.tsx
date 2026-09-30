import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/member-account";
import { SITE } from "@aihot/industry/site";
import { Button } from "../components/ui/Controls";
import { requireMember } from "../lib/member.server";

export const loader = ({ request }: Route.LoaderArgs) => requireMember(request);
export const shouldRevalidate = () => true;
export const meta: Route.MetaFunction = () => [{ title: `我的账号 · ${SITE.name}` }, { name: "robots", content: "noindex, nofollow" }];
export const headers: Route.HeadersFunction = () => ({ "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" });

export default function MemberAccount({ loaderData: member }: Route.ComponentProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function command(path: string, body: unknown, target: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-csrf-token": member.csrf }, body: JSON.stringify(body) });
      if (response.status === 401) { window.location.assign("/login"); return; }
      if (!response.ok) { setError((await response.json()).detail ?? "操作失败，请稍后再试。"); return; }
      window.location.assign(target);
    } catch {
      setError("网络连接失败，请稍后再试。");
    } finally {
      setPending(false);
    }
  }
  function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    if (values.get("newPassword") !== values.get("confirmPassword")) { setError("两次输入的新密码不一致。"); return; }
    void command("/api/member/password", { currentPassword: values.get("currentPassword"), newPassword: values.get("newPassword") }, "/login?changed=1");
  }
  const input = "mt-2 h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-[15px] text-ink outline-none focus:border-accent";
  return (
    <section className="mx-auto max-w-[520px] py-6 lg:py-2">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-[24px] font-semibold text-ink">我的账号</h1><p className="mt-2 text-[14px] text-ink-3">{member.displayName} · {member.username}</p></div>
        <Button disabled={pending} onClick={() => void command("/api/member/logout", {}, "/")}>退出登录</Button>
      </div>
      <form onSubmit={changePassword} className="card mt-6 space-y-4 p-5">
        <h2 className="text-[16px] font-semibold">修改密码</h2>
        <input type="hidden" name="username" value={member.username} autoComplete="username" />
        <label className="block text-[14px] text-ink-2">当前密码<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} className={input} /></label>
        <label className="block text-[14px] text-ink-2">新密码<input name="newPassword" type="password" autoComplete="new-password" required minLength={8} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,128}" maxLength={128} className={input} /></label>
        <label className="block text-[14px] text-ink-2">确认新密码<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,128}" maxLength={128} className={input} /></label>
        <p className="text-[12.5px] leading-relaxed text-ink-4">密码需要 8–128 个字符，且同时包含字母和数字。修改后，所有设备都需要重新登录。</p>
        {error && <p role="alert" className="text-[13px] text-hot">{error}</p>}
        <Button type="submit" variant="primary" disabled={pending}>{pending ? "正在处理…" : "修改密码"}</Button>
      </form>
      <Link to="/" className="mt-5 inline-block text-[13px] text-accent">回到首页</Link>
    </section>
  );
}
