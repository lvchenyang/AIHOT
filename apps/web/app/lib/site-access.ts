import { redirectDocument, type MiddlewareFunction } from "react-router";
import { requiresPageAccess } from "@aihot/contracts/site-access";

/** Also check client navigations, including routes whose prefetched data is already in memory. */
export const clientSiteAccess: MiddlewareFunction = async ({ request }, next) => {
  if (requiresPageAccess(new URL(request.url).pathname)) {
    const response = await fetch("/api/member/access", { credentials: "same-origin", cache: "no-store", signal: request.signal });
    if (response.status === 401) throw redirectDocument("/login");
    if (!response.ok) throw new Response("暂时无法验证登录状态。", { status: 503 });
  }
  return next();
};
