import { data, redirect } from "react-router";
import type { MemberMe } from "@aihot/contracts/members";

const API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:3001";

export async function requireMember(request: Request): Promise<MemberMe> {
  const response = await fetch(`${API_BASE}/api/member/me`, {
    headers: { accept: "application/json", cookie: request.headers.get("cookie") ?? "" },
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
    cache: "no-store",
  });
  if (response.status === 401) throw redirect("/login");
  if (!response.ok) throw data({ message: "暂时无法读取账号信息。" }, { status: 503 });
  return await response.json() as MemberMe;
}
