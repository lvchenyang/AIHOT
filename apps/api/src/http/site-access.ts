import type { FastifyInstance } from "fastify";
import { PRIVATE_HEADERS, requiresSiteAccess } from "@aihot/contracts/site-access";
import { hasSiteAccess } from "@aihot/backend/members/access";
import { sendProblem } from "./respond.ts";

/** Guard the HTTP boundary, leaving publication and worker business logic unchanged. */
export function registerSiteAccess(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    const pathname = new URL(req.raw.url ?? "/", "http://api.local").pathname;
    if (!requiresSiteAccess(pathname)) return;
    if (!await hasSiteAccess(req.headers.cookie)) {
      return sendProblem(req, reply, { status: 401, code: "login_required", title: "Unauthorized", detail: "请先登录。" });
    }
  });
  // Route handlers still declare their old public cache policy. Override it at the final boundary,
  // including conditional responses, errors, RSS, images and MCP streams.
  app.addHook("onSend", async (req, reply, payload) => {
    if (requiresSiteAccess(new URL(req.raw.url ?? "/", "http://api.local").pathname)) {
      reply.headers(PRIVATE_HEADERS);
      reply.removeHeader("Expires");
      const vary = String(reply.getHeader("Vary") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
      if (!vary.some((value) => value.toLowerCase() === "cookie")) vary.push("Cookie");
      reply.header("Vary", vary.join(", "));
    }
    return payload;
  });
}
