import type { FastifyInstance } from "fastify";
import { actorOf } from "@aihot/backend/admin/auth";
import { MemberError } from "@aihot/backend/members/auth";
import { createMember, listMembers, memberId, resetMemberPassword, updateMember } from "@aihot/backend/members/users";
import { sendProblem } from "../http/respond.ts";
import { adminHandler, type AdminHandler } from "./admin-auth.ts";

function usersHandler(fn: AdminHandler) {
  return adminHandler(async (req, reply, admin) => {
    try {
      return await fn(req, reply, admin);
    } catch (error) {
      if (error instanceof MemberError) return sendProblem(req, reply, { status: error.statusCode, code: "invalid_member_request", detail: error.message });
      // Neither submitted passwords nor database error details belong in responses or logs.
      req.log.error({ code: (error as { code?: string })?.code }, "user management failed");
      return sendProblem(req, reply, { status: 503, code: "temporarily_unavailable", detail: "操作未完成，请稍后再试。" });
    }
  });
}

function input(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MemberError(400, "请填写完整信息。");
  return value as Record<string, unknown>;
}

export function registerAdminUsers(app: FastifyInstance) {
  app.get("/api/admin/users", usersHandler(async (req) => listMembers(req.query as Record<string, string>)));
  app.post("/api/admin/users", { bodyLimit: 4096 }, usersHandler(async (req, reply, admin) => {
    const user = await createMember(input(req.body), actorOf(admin));
    return reply.code(201).send(user);
  }));
  app.patch("/api/admin/users/:id", { bodyLimit: 4096 }, usersHandler(async (req, _reply, admin) =>
    updateMember(memberId((req.params as { id: string }).id), input(req.body), actorOf(admin))));
  app.post("/api/admin/users/:id/password", { bodyLimit: 4096 }, usersHandler(async (req, reply, admin) => {
    await resetMemberPassword(memberId((req.params as { id: string }).id), input(req.body).password, actorOf(admin));
    return reply.code(204).send();
  }));
}
