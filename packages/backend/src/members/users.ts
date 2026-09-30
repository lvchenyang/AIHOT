import type { MemberList, MemberUser } from "@aihot/contracts/members";
import { sql } from "../db.ts";
import { hashPassword, MemberError, memberAudit, normalizeUsername } from "./auth.ts";

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  enabled: boolean;
  created_at: Date;
  last_login_at: Date | null;
}

function publicUser(row: UserRow): MemberUser {
  return { id: row.id, username: row.username, displayName: row.display_name, enabled: row.enabled, createdAt: row.created_at.toISOString(), lastLoginAt: row.last_login_at?.toISOString() ?? null };
}

function displayName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || [...value.trim()].length > 80) throw new MemberError(400, "名称需要 1–80 个字符。");
  return value.trim();
}

export function memberId(value: unknown): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new MemberError(400, "用户编号不正确。");
  return id;
}

export async function listMembers(query: { q?: string; page?: string; enabled?: string }): Promise<MemberList> {
  const page = Math.max(1, Math.min(10000, Math.floor(Number(query.page) || 1)));
  const term = String(query.q ?? "").trim().slice(0, 80).replace(/[\\%_]/g, "\\$&");
  const enabled = query.enabled === "true" ? true : query.enabled === "false" ? false : null;
  const rows = await sql<UserRow[]>`SELECT id, username, display_name, enabled, created_at, last_login_at FROM member_users
    WHERE (${`%${term}%`} = '%%' OR username ILIKE ${`%${term}%`} OR display_name ILIKE ${`%${term}%`})
      AND (${enabled}::boolean IS NULL OR enabled = ${enabled})
    ORDER BY id DESC LIMIT 51 OFFSET ${(page - 1) * 50}`;
  return { rows: rows.slice(0, 50).map(publicUser), page, hasMore: rows.length > 50 };
}

export async function createMember(body: Record<string, unknown>, actor: string): Promise<MemberUser> {
  const username = normalizeUsername(body.username);
  if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username)) throw new MemberError(400, "账号需要 3–32 位字母、数字、点、下划线或短横线，并以字母或数字开头。");
  const name = displayName(body.displayName);
  const passwordHash = await hashPassword(body.password);
  return sql.begin(async (tx) => {
    const [row] = await tx<UserRow[]>`INSERT INTO member_users (username, display_name, password_hash)
      VALUES (${username}, ${name}, ${passwordHash}) ON CONFLICT (username) DO NOTHING
      RETURNING id, username, display_name, enabled, created_at, last_login_at`;
    if (!row) throw new MemberError(409, "这个账号已存在，请换一个。");
    const user = publicUser(row);
    await memberAudit(tx, actor, "member.create", user.id, null, user);
    return user;
  }) as Promise<MemberUser>;
}

export async function updateMember(id: number, body: Record<string, unknown>, actor: string): Promise<MemberUser> {
  if (body.displayName === undefined && body.enabled === undefined) throw new MemberError(400, "请填写要修改的名称或状态。");
  const name = body.displayName === undefined ? null : displayName(body.displayName);
  if (body.enabled !== undefined && typeof body.enabled !== "boolean") throw new MemberError(400, "账号状态不正确。");
  return sql.begin(async (tx) => {
    const [before] = await tx<UserRow[]>`SELECT id, username, display_name, enabled, created_at, last_login_at FROM member_users WHERE id = ${id} FOR UPDATE`;
    if (!before) throw new MemberError(404, "用户不存在。");
    const enabled = typeof body.enabled === "boolean" ? body.enabled : before.enabled;
    const [row] = await tx<UserRow[]>`UPDATE member_users SET display_name = ${name ?? before.display_name}, enabled = ${enabled}, updated_at = now() WHERE id = ${id}
      RETURNING id, username, display_name, enabled, created_at, last_login_at`;
    if (!enabled) await tx`DELETE FROM member_sessions WHERE user_id = ${id}`;
    await memberAudit(tx, actor, "member.update", id, publicUser(before), publicUser(row));
    return publicUser(row);
  }) as Promise<MemberUser>;
}

export async function resetMemberPassword(id: number, password: unknown, actor: string) {
  const passwordHash = await hashPassword(password);
  await sql.begin(async (tx) => {
    const [row] = await tx`SELECT id FROM member_users WHERE id = ${id} FOR UPDATE`;
    if (!row) throw new MemberError(404, "用户不存在。");
    await tx`UPDATE member_users SET password_hash = ${passwordHash}, updated_at = now() WHERE id = ${id}`;
    await tx`DELETE FROM member_sessions WHERE user_id = ${id}`;
    await memberAudit(tx, actor, "member.password_reset", id);
  });
}
