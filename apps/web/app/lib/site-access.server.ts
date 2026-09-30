import { AsyncLocalStorage } from "node:async_hooks";
import { data, redirect, type MiddlewareFunction } from "react-router";
import { PRIVATE_HEADERS, requiresPageAccess } from "@aihot/contracts/site-access";

const cookies = new AsyncLocalStorage<string>();
export const requestCookie = () => cookies.getStore() ?? "";

/** One request context forwards the caller's cookie to every existing SSR API loader. */
export const siteAccess: MiddlewareFunction<Response> = async ({ request }, next) => {
  return cookies.run(request.headers.get("cookie") ?? "", async () => {
    if (requiresPageAccess(new URL(request.url).pathname)) {
      const response = await fetch(`${process.env.API_BASE_URL || "http://127.0.0.1:3001"}/api/member/access`, {
        headers: { cookie: requestCookie() },
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
        cache: "no-store",
      });
      if (response.status === 401) throw redirect("/login", { headers: PRIVATE_HEADERS });
      if (!response.ok) throw data({ message: "暂时无法验证登录状态。" }, { status: 503, headers: PRIVATE_HEADERS });
    }
    const response = await next();
    for (const [key, value] of Object.entries(PRIVATE_HEADERS)) response.headers.set(key, value);
    response.headers.delete("Expires");
    return response;
  });
};
