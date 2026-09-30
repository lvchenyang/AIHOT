import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/member-login";
import { SITE } from "@aihot/industry/site";
import { Button } from "../components/ui/Controls";

export const meta: Route.MetaFunction = () => [{ title: `登录 · ${SITE.name}` }, { name: "robots", content: "noindex, nofollow" }];
export const headers: Route.HeadersFunction = () => ({ "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" });

export default function MemberLogin() {
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/member/login", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: values.get("username"), password: values.get("password") }),
      });
      if (!response.ok) {
        const result = await response.json();
        setError(result.detail ?? "登录失败，请稍后再试。");
        return;
      }
      form.reset();
      window.location.assign("/");
    } catch {
      setError("网络连接失败，请稍后再试。");
    } finally {
      setPending(false);
    }
  }
  const input = "mt-2 h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-[15px] text-ink outline-none focus:border-accent";
  return (
    <section className="mx-auto max-w-[400px] py-10 lg:py-16">
      <h1 className="text-[26px] font-semibold text-ink">账号登录</h1>
      <p className="mt-2 text-[14px] text-ink-3">使用管理员提供的账号和密码登录 {SITE.name}。</p>
      {params.get("changed") === "1" && <p role="status" className="mt-5 rounded-control bg-accent-soft p-3 text-[13px] text-accent">密码已修改，请使用新密码登录。</p>}
      <form onSubmit={submit} className="card mt-6 space-y-5 p-6">
        <label className="block text-[14px] font-medium text-ink-2">账号
          <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={32} className={input} />
        </label>
        <label className="block text-[14px] font-medium text-ink-2">密码
          <input name="password" type="password" autoComplete="current-password" required maxLength={256} className={input} />
        </label>
        {error && <p role="alert" className="text-[13px] text-hot">{error}</p>}
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>{pending ? "正在登录…" : "登录"}</Button>
        <p className="text-[12.5px] leading-relaxed text-ink-4">没有账号或忘记密码，请联系管理员。</p>
      </form>
    </section>
  );
}
