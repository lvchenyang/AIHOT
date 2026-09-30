// Run after `npm run build -w @aihot/web`. Real production server/router, synthetic HTTP API only.
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { CATEGORY_KEYS } from "@aihot/contracts/taxonomy";
import { releaseBoundCache } from "../app/lib/api.server.ts";

let web: ChildProcess;
let origin: string;
let logs = "";
let deadline: number;
let refreshAt: string;
let metaDelayMs = 0;
let accessUnavailable = false;
const apiPaths: string[] = [];
const api = createServer((req, res) => {
  const url = new URL(req.url!, "http://api.local");
  apiPaths.push(url.pathname);
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/api/site/meta") {
    const respond = () => res.end(JSON.stringify({ changelogVersion: "2026-09-28T12:00" }));
    return metaDelayMs ? setTimeout(respond, metaDelayMs) : respond();
  }
  if (url.pathname === "/api/member/access") {
    res.statusCode = accessUnavailable ? 503 : /reader-[ab]/.test(req.headers.cookie ?? "") ? 204 : 401;
    return res.end();
  }
  if (url.pathname === "/api/member/me") {
    const username = req.headers.cookie?.includes("reader-b") ? "reader-b" : req.headers.cookie?.includes("reader-a") ? "reader-a" : null;
    res.setHeader("Cache-Control", "private, no-store");
    res.statusCode = username ? 200 : 401;
    return res.end(JSON.stringify(username ? { id: username === "reader-a" ? 1 : 2, username, displayName: username, csrf: `${username}-csrf` } : { code: "unauthorized" }));
  }
  if (url.pathname === "/api/site/timeline") {
    const filters = { channel: "all", category: url.searchParams.get("category"), tag: null, topic: null };
    res.setHeader("X-Accel-Expires", `@${deadline}`);
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=30");
    return res.end(JSON.stringify({ caller: req.headers.cookie, filters, cards: [], nextCursor: null, refreshAt, dayCounts: [], hot: null, generatedAt: "2026-09-28T00:00:00Z" }));
  }
  if (url.pathname === "/api/site/hot") return res.end(JSON.stringify({ entries: [] }));
  if (url.pathname === "/api/site/echo-client") return res.end(JSON.stringify({ forwarded: req.headers["x-forwarded-for"], real: req.headers["x-real-ip"] }));
  if (url.pathname === "/api/site/items/long-lived") return res.end(JSON.stringify({ id: "long-lived", title: "t" }));
  if (url.pathname === "/api/site/contact") return res.end(JSON.stringify({ wechatQr: "/qr.png", feishuQr: "/qr.png" }));
  if (url.pathname === "/api/site/stories/merged") {
    res.statusCode = 308;
    return res.end(JSON.stringify({ mergedInto: "surviving-story" }));
  }
  res.statusCode = url.pathname.startsWith("/api/admin/") ? 401 : 404;
  res.end(JSON.stringify({ code: "not_found" }));
});

before(async () => {
  deadline = Math.floor(Date.now() / 1000) + 20;
  refreshAt = new Date((deadline + 5) * 1000).toISOString();
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  web = spawn(process.execPath, [fileURLToPath(new URL("../server.ts", import.meta.url))], {
    env: { ...process.env, WEB_PORT: "0", TRUST_PROXY: "false", API_BASE_URL: `http://127.0.0.1:${(api.address() as AddressInfo).port}` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`web did not start: ${logs}`)), 15_000);
    web.on("exit", () => { clearTimeout(timeout); reject(new Error(`web exited: ${logs}`)); });
    web.stderr!.on("data", (chunk) => { logs += String(chunk); });
    web.stdout!.on("data", (chunk) => {
      logs += String(chunk);
      const match = logs.match(/"msg":"web started","port":(\d+)/);
      if (match) {
        origin = `http://127.0.0.1:${match[1]}`;
        clearTimeout(timeout);
        resolve();
      }
    });
  });
});

after(async () => {
  if (web && web.exitCode === null) {
    web.kill("SIGTERM");
    await once(web, "exit");
  }
  api.closeAllConnections();
  await new Promise<void>((resolve) => api.close(() => resolve()));
});

const signed = { headers: { cookie: "disongas_member=reader-a" } };
function privateResponse(res: Response) {
  assert.equal(res.headers.get("Cache-Control"), "private, no-store");
  assert.equal(res.headers.get("X-Accel-Expires"), "0");
  assert.equal(res.headers.get("X-Robots-Tag"), "noindex, nofollow");
}

test("the entire system redirects anonymous HTML and data requests before loaders read content", async () => {
  for (const path of ["/", "/all", "/hot", "/policy", "/daily", "/topics", "/about", "/starred", "/terms", "/items/long-lived", "/items/long-lived/original", "/account", "/_.data", "/_.data?_routes=root", "/_.data?_routes=unknown", "/items/long-lived.data?_routes=root", "/about.data"]) {
    const res = await fetch(origin + path, { redirect: "manual" });
    assert.ok([202, 302].includes(res.status), `${path}: ${res.status}`);
    privateResponse(res);
    if (res.status === 302) assert.equal(res.headers.get("Location"), "/login");
    else assert.match(await res.text(), /\/login/);
  }
  assert.ok(!apiPaths.some((path) => path.startsWith("/api/site/")), "anonymous requests never run content loaders");
  for (const path of ["/login", "/admin/login"]) {
    const res = await fetch(origin + path);
    assert.equal(res.status, 200);
    privateResponse(res);
    const body = await res.text();
    assert.match(body, /登录/);
    if (path === "/login") assert.doesNotMatch(body, /href="\/daily"/);
  }
});

test("signed-in SSR forwards each caller's cookie without cross-request contamination or public caching", async () => {
  metaDelayMs = 50;
  try {
    await Promise.all(Array.from({ length: 8 }, async (_, index) => {
      const reader = index % 2 ? "reader-a" : "reader-b";
      const res = await fetch(`${origin}/_.data?_routes=root`, { headers: { cookie: `disongas_member=${reader}` } });
      assert.equal(res.status, 200);
      privateResponse(res);
      const body = await res.text();
      assert.match(body, /routes\/home/);
      assert.ok(body.includes(reader));
      assert.ok(!body.includes(reader === "reader-a" ? "reader-b" : "reader-a"));
    }));
  } finally { metaDelayMs = 0; }
  const html = await fetch(origin + "/", signed);
  assert.equal(html.status, 200);
  privateResponse(html);
  assert.match(await html.text(), /精选/);
  const category = CATEGORY_KEYS.at(-1)!;
  const filtered = await fetch(`${origin}/_.data?category=${category}&_routes=root`, signed);
  assert.match(await filtered.text(), new RegExp(category));
});

test("missing content, redirects, actions and upstream authentication failure stay uncached", async () => {
  for (const path of ["/items/missing", "/items/missing.data?_routes=root", "/does-not-exist.data"]) {
    const res = await fetch(origin + path, signed);
    assert.equal(res.status, 404, path);
    privateResponse(res);
    await res.text();
  }
  const merged = await fetch(origin + "/story/merged.data?_routes=root", signed);
  assert.equal(merged.status, 202);
  privateResponse(merged);
  assert.match(await merged.text(), /story\/surviving-story/);
  const action = await fetch(origin + "/hot.data", { ...signed, method: "POST" });
  assert.equal(action.status, 405);
  privateResponse(action);
  const reads = apiPaths.filter((path) => path === "/api/site/timeline").length;
  accessUnavailable = true;
  try {
    const res = await fetch(origin + "/", signed);
    assert.equal(res.status, 503);
    privateResponse(res);
    await res.text();
    assert.equal(apiPaths.filter((path) => path === "/api/site/timeline").length, reads);
  } finally { accessUnavailable = false; }
});

test("administrator login remains independent and reader accounts cannot bypass admin authentication", async () => {
  const res = await fetch(origin + "/admin/sources.data?_routes=admin-layout", signed);
  assert.equal(res.status, 202);
  privateResponse(res);
  assert.match(await res.text(), /admin\/login/);
});

test("account responses remain specific to the current reader", async () => {
  for (const path of ["/account", "/account.data?_routes=root"]) {
    for (const username of ["reader-a", "reader-b"]) {
      const res = await fetch(origin + path, { headers: { cookie: `disongas_member=${username}` } });
      assert.equal(res.status, 200);
      privateResponse(res);
      const body = await res.text();
      assert.ok(body.includes(username));
      assert.ok(!body.includes(username === "reader-a" ? "reader-b" : "reader-a"));
    }
  }
});

test("the proxy ignores forged client addresses", async () => {
  const res = await fetch(origin + "/api/site/echo-client", { headers: { "X-Forwarded-For": "6.6.6.6", "X-Real-IP": "6.6.6.6" } });
  assert.deepEqual(await res.json(), { forwarded: "127.0.0.1", real: "127.0.0.1" });
});

test("the publication deadline helper still honors the earliest upstream deadline", () => {
  const now = Date.parse("2026-09-28T00:00:00Z");
  const upstream = new Headers({ "X-Accel-Expires": `@${now / 1000 + 7}` });
  assert.equal(releaseBoundCache(new Date(now + 20_000).toISOString(), 30, now + 2_000, upstream)["Cache-Control"], "public, max-age=0, s-maxage=5");
});
