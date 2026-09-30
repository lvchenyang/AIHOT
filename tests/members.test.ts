import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { config } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { MEMBER_COOKIE } from "@aihot/backend/members/auth";
import { buildApp } from "../apps/api/src/app.ts";

config.devAdmin = null;
config.siteUrl = "https://members.example.test";
config.adminPassword = "test-admin-password-only";
const app = await buildApp();
const origin = config.siteUrl;
const password = "test-member-password-1";
const newPassword = "test-member-password-2";
const prefix = tag();
let sequence = 0;
const adminLogin = await app.inject({ method: "POST", url: "/api/auth/password", payload: { password: config.adminPassword } });
assert.equal(adminLogin.statusCode, 303);
const adminCookie = String(adminLogin.headers["set-cookie"]).split(";")[0];
const adminMe = (await app.inject({ url: "/api/admin/me", headers: { cookie: adminCookie } })).json();
const adminHeaders = { cookie: adminCookie, "x-csrf-token": adminMe.csrf, origin };
const cookieOf = (response: { headers: Record<string, unknown> }) => String(response.headers["set-cookie"]).split(";")[0];

beforeEach(async () => { await sql`DELETE FROM member_login_limits`; });
after(async () => { await app.close(); await closeDb(); });

async function createUser() {
  const username = `${prefix}_${++sequence}`;
  const response = await app.inject({ method: "POST", url: "/api/admin/users", headers: adminHeaders, payload: { username, displayName: "测试用户", password } });
  assert.equal(response.statusCode, 201, response.body);
  return response.json() as { id: number; username: string; displayName: string; enabled: boolean };
}
const login = (username: string, value = password, extra: Record<string, string> = {}) => app.inject({ method: "POST", url: "/api/member/login", headers: { origin, ...extra }, payload: { username, password: value, return: "https://evil.example" } });
const me = (cookie: string) => app.inject({ url: "/api/member/me", headers: { cookie } });

test("only administrators with CSRF can manage users; there is no public registration", async () => {
  for (const method of ["GET", "POST"] as const) {
    assert.equal((await app.inject({ method, url: "/api/admin/users" })).statusCode, 401);
  }
  assert.equal((await app.inject({ method: "POST", url: "/api/admin/users", headers: { cookie: adminCookie }, payload: {} })).statusCode, 403);
  assert.equal((await app.inject({ method: "POST", url: "/api/member/register", payload: {} })).statusCode, 404);
  assert.equal((await me(adminCookie)).statusCode, 401);
});

test("create, duplicate checks, edits, search and audit never disclose passwords", async () => {
  const user = await createUser();
  const duplicate = await app.inject({ method: "POST", url: "/api/admin/users", headers: adminHeaders, payload: { username: user.username.toUpperCase(), displayName: "重复", password } });
  assert.equal(duplicate.statusCode, 409);
  const invalid = await app.inject({ method: "POST", url: "/api/admin/users", headers: adminHeaders, payload: { username: "invalid name", displayName: "测试", password } });
  assert.equal(invalid.statusCode, 400);
  const short = await app.inject({ method: "POST", url: "/api/admin/users", headers: adminHeaders, payload: { username: "valid_name", displayName: "测试", password: "short" } });
  assert.equal(short.statusCode, 400);
  const changed = await app.inject({ method: "PATCH", url: `/api/admin/users/${user.id}`, headers: adminHeaders, payload: { displayName: "新的名称", role: "admin" } });
  assert.equal(changed.statusCode, 200);
  assert.equal(changed.json().displayName, "新的名称");
  const list = await app.inject({ url: `/api/admin/users?q=${user.username}`, headers: adminHeaders });
  assert.equal(list.statusCode, 200);
  assert.equal(list.headers["cache-control"], "no-store");
  assert.equal(list.json().rows.length, 1);
  assert.doesNotMatch(list.body, /password|csrf|scrypt|role/);
  const [stored] = await sql`SELECT password_hash FROM member_users WHERE id = ${user.id}`;
  assert.match(stored.password_hash, /^scrypt\$131072\$8\$1\$/);
  assert.ok(!stored.password_hash.includes(password));
  const another = await createUser();
  const [second] = await sql`SELECT password_hash FROM member_users WHERE id = ${another.id}`;
  assert.notEqual(stored.password_hash, second.password_hash, "the same password has independent salts");
  const audit = await sql`SELECT actor, action, before, after FROM audit_log WHERE subject = ${`member:${user.id}`} ORDER BY id`;
  assert.deepEqual(audit.map((row) => row.action), ["member.create", "member.update"]);
  assert.match(audit[0].actor, /^admin:/);
  assert.doesNotMatch(JSON.stringify(audit), /scrypt|password_hash|test-member-password/);
  assert.equal((await app.inject({ method: "PATCH", url: "/api/admin/users/invalid", headers: adminHeaders, payload: { enabled: false } })).statusCode, 400);
  assert.equal((await app.inject({ method: "PATCH", url: "/api/admin/users/999999999", headers: adminHeaders, payload: { enabled: false } })).statusCode, 404);
});

test("login returns home, isolates roles and rotates sessions", async () => {
  const user = await createUser();
  const response = await login(` ${user.username.toUpperCase()} `);
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json(), { redirectTo: "/" });
  assert.match(String(response.headers["set-cookie"]), /HttpOnly; SameSite=Lax; Max-Age=604800; Secure/);
  assert.match(String(response.headers["cache-control"]), /no-store/);
  const memberCookie = cookieOf(response);
  assert.ok(memberCookie.startsWith(`${MEMBER_COOKIE}=`));
  const profile = await me(`${memberCookie}; unrelated=%ZZ`);
  assert.equal(profile.statusCode, 200);
  assert.equal(profile.json().username, user.username);
  assert.doesNotMatch(profile.body, /password/);
  assert.equal((await app.inject({ url: "/api/admin/me", headers: { cookie: memberCookie } })).statusCode, 401);
  assert.equal((await app.inject({ method: "POST", url: "/api/admin/users", headers: { cookie: memberCookie, "x-csrf-token": profile.json().csrf }, payload: {} })).statusCode, 401);
  const [session] = await sql`SELECT id_hash FROM member_sessions WHERE user_id = ${user.id}`;
  assert.notEqual(session.id_hash, memberCookie.split("=")[1]);
  const publicPlain = await app.inject({ url: "/api/site/meta" });
  const publicMember = await app.inject({ url: "/api/site/meta", headers: { cookie: memberCookie } });
  assert.equal(publicPlain.statusCode, 401);
  assert.equal(publicMember.statusCode, 200);
  assert.equal(publicPlain.headers["cache-control"], publicMember.headers["cache-control"]);
  const again = await login(user.username, password, { cookie: memberCookie });
  assert.equal(again.statusCode, 200);
  assert.equal((await me(memberCookie)).statusCode, 401, "the previous browser session is rotated");
  assert.equal((await me(cookieOf(again))).statusCode, 200);
  assert.equal((await app.inject({ url: "/api/admin/me", headers: { cookie: adminCookie } })).statusCode, 200);
});

test("bad credentials and cross-site attempts cannot establish sessions", async () => {
  const user = await createUser();
  const wrong = await login(user.username, "wrong-password");
  const missing = await login("account-does-not-exist", "wrong-password");
  assert.equal(wrong.statusCode, 401);
  assert.equal(missing.statusCode, 401);
  assert.equal(wrong.json().detail, missing.json().detail);
  assert.equal(wrong.headers["set-cookie"], undefined);
  assert.equal((await login(user.username, password, { origin: "https://evil.example" })).statusCode, 403);
  assert.equal((await app.inject({ method: "POST", url: "/api/member/login", payload: { username: user.username, password } })).statusCode, 403);
  assert.equal((await me(`${MEMBER_COOKIE}=%ZZ`)).statusCode, 401);
});

test("disable and password reset invalidate every session, including after re-enabling", async () => {
  const user = await createUser();
  const first = cookieOf(await login(user.username));
  const second = cookieOf(await login(user.username));
  const disabled = await app.inject({ method: "PATCH", url: `/api/admin/users/${user.id}`, headers: adminHeaders, payload: { enabled: false } });
  assert.equal(disabled.statusCode, 200);
  assert.equal((await me(first)).statusCode, 401);
  assert.equal((await me(second)).statusCode, 401);
  assert.equal((await login(user.username)).statusCode, 401);
  const list = await app.inject({ url: `/api/admin/users?enabled=false&q=${user.username}`, headers: adminHeaders });
  assert.equal(list.json().rows[0].id, user.id);
  await app.inject({ method: "PATCH", url: `/api/admin/users/${user.id}`, headers: adminHeaders, payload: { enabled: true } });
  assert.equal((await me(first)).statusCode, 401);
  const renewed = cookieOf(await login(user.username));
  const reset = await app.inject({ method: "POST", url: `/api/admin/users/${user.id}/password`, headers: adminHeaders, payload: { password: newPassword } });
  assert.equal(reset.statusCode, 204, reset.body);
  assert.equal((await me(renewed)).statusCode, 401);
  assert.equal((await login(user.username)).statusCode, 401);
  assert.equal((await login(user.username, newPassword)).statusCode, 200);
  const audit = await sql`SELECT action, before, after FROM audit_log WHERE subject = ${`member:${user.id}`} AND action = 'member.password_reset'`;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].after, null);
});

test("password change requires the current password, origin and CSRF, then signs out all devices", async () => {
  const user = await createUser();
  const first = cookieOf(await login(user.username));
  const second = cookieOf(await login(user.username));
  const csrf = (await me(first)).json().csrf;
  const request = { method: "POST" as const, url: "/api/member/password", payload: { currentPassword: password, newPassword } };
  assert.equal((await app.inject({ ...request, headers: { cookie: first, origin } })).statusCode, 403);
  assert.equal((await app.inject({ ...request, headers: { cookie: first, origin: "https://evil.example", "x-csrf-token": csrf } })).statusCode, 403);
  assert.equal((await app.inject({ ...request, headers: { cookie: first, origin, "x-csrf-token": csrf }, payload: { currentPassword: "wrong", newPassword } })).statusCode, 400);
  assert.equal((await me(second)).statusCode, 200);
  const changed = await app.inject({ ...request, headers: { cookie: first, origin, "x-csrf-token": csrf } });
  assert.equal(changed.statusCode, 204, changed.body);
  assert.match(String(changed.headers["set-cookie"]), /Max-Age=0/);
  assert.equal((await me(first)).statusCode, 401);
  assert.equal((await me(second)).statusCode, 401);
  assert.equal((await login(user.username)).statusCode, 401);
  assert.equal((await login(user.username, newPassword)).statusCode, 200);
});

test("logout is protected and expired sessions cannot be used", async () => {
  const user = await createUser();
  const cookie = cookieOf(await login(user.username));
  const csrf = (await me(cookie)).json().csrf;
  assert.equal((await app.inject({ method: "POST", url: "/api/member/logout", headers: { cookie, origin } })).statusCode, 403);
  const out = await app.inject({ method: "POST", url: "/api/member/logout", headers: { cookie, origin, "x-csrf-token": csrf } });
  assert.equal(out.statusCode, 204);
  assert.equal((await me(cookie)).statusCode, 401);
  const next = cookieOf(await login(user.username));
  await sql`UPDATE member_sessions SET expires_at = now() - interval '1 second' WHERE user_id = ${user.id}`;
  assert.equal((await me(next)).statusCode, 401);
});

test("login throttling survives another API instance and expires after its fixed window", async () => {
  for (let index = 0; index < 10; index++) {
    const response = await login("missing-account-for-rate-limit", "wrong", { "x-forwarded-for": `203.0.113.${index}` });
    assert.equal(response.statusCode, 401);
  }
  const other = await buildApp();
  try {
    const response = await other.inject({ method: "POST", url: "/api/member/login", headers: { origin, "x-forwarded-for": "203.0.113.200" }, payload: { username: "missing-account-for-rate-limit", password } });
    assert.equal(response.statusCode, 429);
    assert.equal(response.headers["retry-after"], "900");
  } finally { await other.close(); }
  await sql`UPDATE member_login_limits SET expires_at = now() - interval '1 second'`;
  assert.equal((await login("missing-account-for-rate-limit", "wrong")).statusCode, 401);
});

test("user search pagination is stable and wildcard characters are treated literally", async () => {
  const user = await createUser();
  const [stored] = await sql`SELECT password_hash FROM member_users WHERE id = ${user.id}`;
  const group = `${prefix}_page`;
  await sql`INSERT INTO member_users (username, display_name, password_hash)
    SELECT ${group} || n, '分页用户', ${stored.password_hash} FROM generate_series(1, 55) n`;
  const first = (await app.inject({ url: `/api/admin/users?q=${group}`, headers: adminHeaders })).json();
  const second = (await app.inject({ url: `/api/admin/users?q=${group}&page=2`, headers: adminHeaders })).json();
  assert.equal(first.rows.length, 50);
  assert.equal(first.hasMore, true);
  assert.equal(second.rows.length, 5);
  assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.rows, ...second.rows].map((row) => row.id)).size, 55);
  assert.equal((await app.inject({ url: "/api/admin/users?q=%25", headers: adminHeaders })).json().rows.length, 0);
});

test("the global login cap blocks hashing and additional per-client rate-limit rows", async () => {
  await sql`INSERT INTO member_login_limits (key, attempts, expires_at) VALUES ('login:all', 100, now() + interval '15 minutes')`;
  const response = await login("another-new-account", password, { "x-forwarded-for": "203.0.113.240" });
  assert.equal(response.statusCode, 429);
  const rows = await sql`SELECT key FROM member_login_limits`;
  assert.deepEqual(rows.map((row) => row.key), ["login:all"]);
});

test("all content exits require a live session, including conditional requests and MCP", async () => {
  const paths = ["/api/site/meta", "/api/site/timeline", "/api/site/items/anything", "/api/v1/items", "/api/v1/selected/snapshot", "/feed.xml", "/feed/category/policy.xml", "/sitemap.xml", "/llms.txt", "/openapi-v1.json", "/og/site.png", "/items/anything/markdown", "/api/img-proxy?url=anything", "/api/mcp"];
  for (const path of paths) {
    for (const method of ["GET", "HEAD"] as const) {
      const response = await app.inject({ method, url: path, headers: { "if-none-match": "*", "x-aihot-ssr": "1", cookie: "disongas_member=forged" } });
      assert.equal(response.statusCode, 401, path);
      assert.equal(response.headers["cache-control"], "private, no-store");
      assert.equal(response.headers["x-accel-expires"], "0");
    }
  }
  assert.equal((await app.inject({ method: "POST", url: "/api/mcp", payload: {} })).statusCode, 401);
  const user = await createUser();
  const cookie = cookieOf(await login(user.username));
  for (const path of ["/api/site/meta", "/api/v1/items", "/feed.xml", "/sitemap.xml"]) {
    const response = await app.inject({ url: path, headers: { cookie } });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers["cache-control"], "private, no-store");
    assert.equal(response.headers["x-accel-expires"], "0");
    assert.match(String(response.headers.vary), /Cookie/);
    if (response.headers.etag) {
      const conditional = await app.inject({ url: path, headers: { cookie, "if-none-match": String(response.headers.etag) } });
      assert.equal(conditional.statusCode, 304);
      assert.equal(conditional.headers["cache-control"], "private, no-store");
    }
  }
  assert.equal((await app.inject({ url: "/api/member/access", headers: { cookie: adminCookie } })).statusCode, 204);
  await app.inject({ method: "PATCH", url: `/api/admin/users/${user.id}`, headers: adminHeaders, payload: { enabled: false } });
  for (const path of [...paths, "/api/member/access"]) assert.equal((await app.inject({ url: path, headers: { cookie } })).statusCode, 401, path);
  const oldDevAdmin = config.devAdmin;
  config.devAdmin = { displayName: "测试开发管理员" };
  try {
    assert.equal((await app.inject({ url: "/api/member/access" })).statusCode, 401);
    assert.equal((await app.inject({ url: "/api/site/timeline" })).statusCode, 401);
  } finally { config.devAdmin = oldDevAdmin; }
  assert.equal((await app.inject({ url: "/api/health" })).statusCode, 200);
  assert.match((await app.inject({ url: "/robots.txt" })).body, /Disallow: \//);
});

test("create, reset and change accept eight characters with letters and digits and reject weaker values", async () => {
  const username = `${prefix}_${++sequence}`;
  for (const password of ["abc1234", "abcdefgh", "12345678", "!!!!!!!!", "abc12345".repeat(17)]) {
    assert.equal((await app.inject({ method: "POST", url: "/api/admin/users", headers: adminHeaders, payload: { username, displayName: "密码校验", password } })).statusCode, 400);
  }
  const created = await app.inject({ method: "POST", url: "/api/admin/users", headers: adminHeaders, payload: { username, displayName: "密码校验", password: "abc12345" } });
  assert.equal(created.statusCode, 201);
  const id = created.json().id;
  const cookie = cookieOf(await login(username, "abc12345"));
  const csrf = (await me(cookie)).json().csrf;
  assert.equal((await app.inject({ method: "POST", url: `/api/admin/users/${id}/password`, headers: adminHeaders, payload: { password: "abcdefgh" } })).statusCode, 400);
  const headers = { cookie, origin, "x-csrf-token": csrf };
  assert.equal((await app.inject({ method: "POST", url: "/api/member/password", headers, payload: { currentPassword: "abc12345", newPassword: "12345678" } })).statusCode, 400);
  assert.equal((await app.inject({ method: "POST", url: "/api/member/password", headers, payload: { currentPassword: "abc12345", newPassword: "new12345" } })).statusCode, 204);
  assert.equal((await login(username, "new12345")).statusCode, 200);
  assert.equal((await app.inject({ method: "POST", url: `/api/admin/users/${id}/password`, headers: adminHeaders, payload: { password: "pwd12345" } })).statusCode, 204);
  assert.equal((await login(username, "pwd12345")).statusCode, 200);
});
