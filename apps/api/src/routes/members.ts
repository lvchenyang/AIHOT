import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { MemberMe } from "@aihot/contracts/members";
import { config } from "@aihot/backend/config";
import { changeMemberPassword, limitMemberAttempts, loginMember, logoutMember, MemberError, memberCookie, memberPrincipal, normalizeUsername } from "@aihot/backend/members/auth";
import { sendProblem } from "../http/respond.ts";

type MemberHandler = (req: FastifyRequest, reply: FastifyReply, member: MemberMe) => Promise<unknown>;

function problem(req: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof MemberError) return sendProblem(req, reply, { status: error.statusCode, code: error.statusCode === 429 ? "rate_limited" : "member_request_failed", detail: error.message, ...(error.statusCode === 429 ? { retryAfter: 900 } : {}) });
  req.log.error({ code: (error as { code?: string })?.code, path: req.url.split("?")[0] }, "member request failed");
  return sendProblem(req, reply, { status: 503, code: "temporarily_unavailable", detail: "服务暂时不可用，请稍后再试。" });
}

function sameOrigin(req: FastifyRequest): void {
  if (req.headers.origin !== new URL(config.siteUrl).origin) throw new MemberError(403, "请求来源不正确，请从本站重新操作。");
}

function body(req: FastifyRequest): Record<string, unknown> {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) throw new MemberError(400, "请填写完整信息。");
  return req.body as Record<string, unknown>;
}

/** Future private features use this guard; reader sessions never grant administrator access. */
export function memberHandler(fn: MemberHandler) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    reply.header("Cache-Control", "private, no-store");
    try {
      const member = await memberPrincipal(req.headers.cookie);
      if (!member) throw new MemberError(401, "请先登录。");
      if (req.method !== "GET" && req.method !== "HEAD") {
        sameOrigin(req);
        if (req.headers["x-csrf-token"] !== member.csrf) throw new MemberError(403, "页面已过期，请刷新后重试。");
      }
      return await fn(req, reply, member);
    } catch (error) {
      return problem(req, reply, error);
    }
  };
}

export function registerMembers(app: FastifyInstance) {
  app.post("/api/member/login", { bodyLimit: 4096 }, async (req, reply) => {
    reply.header("Cache-Control", "private, no-store");
    try {
      sameOrigin(req);
      const input = body(req);
      await limitMemberAttempts(req.ip, normalizeUsername(input.username));
      const token = await loginMember(input.username, input.password, req.headers.cookie);
      return reply.header("Set-Cookie", memberCookie(token)).send({ redirectTo: "/" });
    } catch (error) {
      return problem(req, reply, error);
    }
  });
  app.get("/api/member/me", memberHandler(async (_req, _reply, member) => member));
  app.post("/api/member/logout", { bodyLimit: 4096 }, memberHandler(async (req, reply) => {
    await logoutMember(req.headers.cookie);
    return reply.header("Set-Cookie", memberCookie("")).code(204).send();
  }));
  app.post("/api/member/password", { bodyLimit: 4096 }, memberHandler(async (req, reply, member) => {
    const input = body(req);
    await limitMemberAttempts(req.ip, member.username, "password");
    await changeMemberPassword(member, input.currentPassword, input.newPassword, req.headers.cookie);
    return reply.header("Set-Cookie", memberCookie("")).code(204).send();
  }));
}
