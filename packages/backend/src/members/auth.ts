import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { MemberMe } from "@aihot/contracts/members";
import { cookie } from "../admin/auth.ts";
import { config } from "../config.ts";
import { sql, type Tx } from "../db.ts";
import { sha256 } from "../lib/ids.ts";

export const MEMBER_COOKIE = "disongas_member";
const SESSION_SECONDS = 7 * 86400;
// Node's built-in scrypt avoids a native dependency. OWASP's N=2^17, r=8, p=1 profile.
const SCRYPT = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
const DUMMY_HASH = `scrypt$131072$8$1$${"00".repeat(16)}$${"00".repeat(64)}`;

export class MemberError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function normalizeUsername(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validatePassword(value: unknown): string {
  if (typeof value !== "string" || [...value].length < 8 || [...value].length > 128 || !/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    throw new MemberError(400, "密码需要 8–128 个字符，且同时包含字母和数字。");
  }
  return value;
}

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, SCRYPT, (error, key) => error ? reject(error) : resolve(key)));
}

export async function hashPassword(value: unknown): Promise<string> {
  const password = validatePassword(value);
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$131072$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPassword(value: unknown, hash: string): Promise<boolean> {
  if (typeof value !== "string" || value.length > 256) return false;
  const match = /^scrypt\$131072\$8\$1\$([0-9a-f]{32})\$([0-9a-f]{128})$/.exec(hash);
  if (!match) return false;
  return timingSafeEqual(await derive(value, Buffer.from(match[1], "hex")), Buffer.from(match[2], "hex"));
}

export function memberCookie(token: string): string {
  return cookie(MEMBER_COOKIE, token, token ? SESSION_SECONDS : 0, config.siteUrl.startsWith("https://"));
}

function sessionHash(header: string | undefined): string | null {
  // Only inspect our own cookie; malformed unrelated cookies must not break sign-in.
  const token = header?.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${MEMBER_COOKIE}=`))?.slice(MEMBER_COOKIE.length + 1);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? sha256(token) : null;
}

export async function memberPrincipal(header: string | undefined): Promise<MemberMe | null> {
  const hash = sessionHash(header);
  if (!hash) return null;
  const [user] = await sql<MemberMe[]>`
    SELECT u.id, u.username, u.display_name AS "displayName", s.csrf_token AS csrf
    FROM member_sessions s JOIN member_users u ON u.id = s.user_id
    WHERE s.id_hash = ${hash} AND s.expires_at > now() AND u.enabled`;
  return user ?? null;
}

/** Fixed windows, including misses: neither a restart nor a new API process resets the limits. */
export async function limitMemberAttempts(ip: string, username: string, operation = "login"): Promise<void> {
  const keys = [["all", 100], [`ip:${sha256(ip)}`, 20], [`account:${sha256(username)}`, 10]] as const;
  await sql`DELETE FROM member_login_limits WHERE expires_at <= now()`;
  for (const [key, limit] of keys) {
    const [row] = await sql<{ attempts: number }[]>`
      INSERT INTO member_login_limits (key, attempts, expires_at) VALUES (${`${operation}:${key}`}, 1, now() + interval '15 minutes')
      ON CONFLICT (key) DO UPDATE SET attempts = member_login_limits.attempts + 1 RETURNING attempts`;
    // Stop before creating more per-client rows when the broader limit is exhausted.
    if (row.attempts > limit) throw new MemberError(429, "尝试次数过多，请 15 分钟后再试。");
  }
}

export async function memberAudit(tx: Tx, actor: string, action: string, id: number, before: unknown = null, after: unknown = null) {
  await tx`INSERT INTO audit_log (actor, action, subject, before, after)
    VALUES (${actor}, ${action}, ${`member:${id}`}, ${before === null ? null : tx.json(before as never)}, ${after === null ? null : tx.json(after as never)})`;
}

export async function loginMember(usernameInput: unknown, password: unknown, previousCookie?: string): Promise<string> {
  const username = normalizeUsername(usernameInput);
  const [user] = await sql<{ id: number; password_hash: string; enabled: boolean }[]>`
    SELECT id, password_hash, enabled FROM member_users WHERE username = ${username}`;
  const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!valid || !user?.enabled) throw new MemberError(401, "账号或密码不正确，或账号已停用。");
  const token = randomBytes(32).toString("base64url");
  await sql.begin(async (tx) => {
    // Serialize against password resets and disable operations before issuing a new session.
    const [current] = await tx`SELECT id FROM member_users WHERE id = ${user.id} AND enabled AND password_hash = ${user.password_hash} FOR UPDATE`;
    if (!current) throw new MemberError(401, "账号或密码不正确，或账号已停用。");
    const oldHash = sessionHash(previousCookie);
    await tx`DELETE FROM member_sessions WHERE expires_at <= now() OR id_hash = ${oldHash}`;
    await tx`INSERT INTO member_sessions (id_hash, user_id, csrf_token, expires_at)
      VALUES (${sha256(token)}, ${user.id}, ${randomBytes(24).toString("base64url")}, now() + interval '7 days')`;
    await tx`UPDATE member_users SET last_login_at = now() WHERE id = ${user.id}`;
    await memberAudit(tx, `member:${user.id}`, "member.login", user.id);
  });
  return token;
}

export async function logoutMember(header: string | undefined): Promise<void> {
  const hash = sessionHash(header);
  if (hash) await sql`DELETE FROM member_sessions WHERE id_hash = ${hash}`;
}

export async function changeMemberPassword(member: MemberMe, currentPassword: unknown, newPassword: unknown, header: string | undefined) {
  validatePassword(newPassword);
  const [user] = await sql<{ password_hash: string }[]>`SELECT password_hash FROM member_users WHERE id = ${member.id} AND enabled`;
  if (!user || !await verifyPassword(currentPassword, user.password_hash)) throw new MemberError(400, "当前密码不正确。");
  if (currentPassword === newPassword) throw new MemberError(400, "新密码不能与当前密码相同。");
  const passwordHash = await hashPassword(newPassword);
  await sql.begin(async (tx) => {
    const [current] = await tx`SELECT id FROM member_users WHERE id = ${member.id} AND enabled AND password_hash = ${user.password_hash} FOR UPDATE`;
    const [session] = await tx`SELECT id_hash FROM member_sessions WHERE id_hash = ${sessionHash(header)} AND user_id = ${member.id} AND expires_at > now()`;
    if (!current || !session) throw new MemberError(401, "登录已失效，请重新登录。");
    await tx`UPDATE member_users SET password_hash = ${passwordHash}, updated_at = now() WHERE id = ${member.id}`;
    await tx`DELETE FROM member_sessions WHERE user_id = ${member.id}`;
    await memberAudit(tx, `member:${member.id}`, "member.password_change", member.id);
  });
}
