import { SESSION_COOKIE, sessionPrincipal } from "../admin/auth.ts";
import { memberPrincipal } from "./auth.ts";

/** Admin preview may read content, but a development admin bypass never opens the reader site. */
export async function hasSiteAccess(cookie: string | undefined): Promise<boolean> {
  if (await memberPrincipal(cookie)) return true;
  const adminCookie = cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!adminCookie) return false;
  try {
    const admin = await sessionPrincipal(adminCookie);
    return !!admin && !admin.dev;
  } catch (error) {
    if (error instanceof URIError) return false;
    throw error;
  }
}
