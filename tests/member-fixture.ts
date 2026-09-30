import "./setup.ts";
import { randomBytes, createHash } from "node:crypto";
import { sql } from "@aihot/backend/db";

/** A real enabled reader session for publication tests that don't exercise password sign-in. */
export async function readerCookie(): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const [user] = await sql`INSERT INTO member_users (username, display_name, password_hash)
    VALUES (${`fixture_${randomBytes(8).toString("hex")}`}, '测试读者', 'cannot-login') RETURNING id`;
  await sql`INSERT INTO member_sessions (id_hash, user_id, csrf_token, expires_at)
    VALUES (${createHash("sha256").update(token).digest("hex")}, ${user!.id}, 'fixture-csrf', now() + interval '1 hour')`;
  return `disongas_member=${token}`;
}
