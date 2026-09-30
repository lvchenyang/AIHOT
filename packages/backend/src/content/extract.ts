// Article body extraction: readable text from the article page, or "unconfirmed" — never a wrong body.
// Jina Reader is the budgeted fallback for pages that only render in a browser.
import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { sql } from "../db.ts";
import { guardedFetch } from "../lib/http-fetch.ts";
import { collapseWhitespace, stripTags } from "../lib/text.ts";
import { jinaRead } from "../providers/jina.ts";
import { BudgetExceededError } from "../providers/receipts.ts";
import { getArticle } from "../providers/socialdata.ts";
import { onlyXArticleLink, xArticleText } from "../sources/x.ts";
import { dropPageChrome } from "./sanitize.ts";
import { bodyToMarkdown, markdownToBody } from "./markdown.ts";
import { contentHash } from "./materials.ts";

export interface ExtractedBody {
  html: string;
  markdown: string;
  text: string;
  images: Array<{ kind: "image"; url: string; width: number | null; height: number | null }>;
  via: "readability" | "selector" | "jina";
}

const MIN_BODY_CHARS = 200;

export interface BodyRules {
  selector?: string;
  removeSelectors?: string[];
}

function extracted(html: string, url: string, via: ExtractedBody["via"], explicit = false): ExtractedBody | null {
  const markdown = bodyToMarkdown(html, url);
  const clean = markdownToBody(markdown, url);
  const text = stripTags(clean);
  const $ = cheerio.load(clean, null, false);
  const images: ExtractedBody["images"] = [];
  $("img[src]").each((_, el) => {
    const img = $(el);
    const src = img.attr("src")!;
    if (images.length >= 12 || !/^https?:\/\//.test(src) || images.some((image) => image.url === src)) return;
    images.push({ kind: "image", url: src, width: Number(img.attr("width")) || null, height: Number(img.attr("height")) || null });
  });
  if (explicit ? !text.trim() && !images.length : text.length < MIN_BODY_CHARS) return null;
  return { html: clean, markdown, text, images, via };
}

export function readable(html: string, url: string, rules: BodyRules = {}): ExtractedBody | null {
  const $ = cheerio.load(html);
  if (rules.selector) {
    const selected = $(rules.selector);
    // Missing or ambiguous containers must never fall back to the whole page.
    if (selected.length !== 1) return null;
    return extracted(dropPageChrome(selected.html() ?? "", rules.removeSelectors), url, "selector", true);
  }
  $("body > header, body > footer").remove();
  const { document } = parseHTML(dropPageChrome($.html(), rules.removeSelectors));
  try {
    const base = document.createElement("base");
    base.setAttribute("href", url);
    document.head?.appendChild(base);
  } catch {
    // no head
  }
  const article = new Readability(document as unknown as ConstructorParameters<typeof Readability>[0], { charThreshold: MIN_BODY_CHARS, keepClasses: false }).parse();
  return article?.content ? extracted(article.content, url, "readability") : null;
}

export async function extractFromUrl(url: string, opts: { allowJina: boolean; subject: string; body?: BodyRules }): Promise<ExtractedBody | null> {
  try {
    const res = await guardedFetch(url, { timeoutMs: 20_000, maxBytes: 6 * 1024 * 1024 });
    const type = res.headers.get("content-type") ?? "";
    if (res.status === 200 && /html/.test(type)) {
      const got = readable(res.text(), res.url, opts.body);
      if (got) return got;
    }
  } catch {
    // fall through to Jina
  }
  if (!opts.allowJina) return null;
  try {
    // CSS rules need the rendered DOM, not Markdown with all selectors already erased.
    const hasRules = !!opts.body?.selector || !!opts.body?.removeSelectors?.length;
    const page = await jinaRead(url, { purpose: "body_fallback", subject: opts.subject, format: hasRules ? "html" : "markdown" });
    if (hasRules) {
      const got = readable(page.markdown, url, opts.body);
      return got ? { ...got, via: "jina" } : null;
    }
    return extracted(markdownToBody(page.markdown, url), url, "jina");
  } catch (error) {
    if (error instanceof BudgetExceededError) return null;
    throw error;
  }
}

/** Pages extraction can fetch: ordinary web pages (X posts and WeChat articles arrive whole or not at all). */
export function pageFetchable(url: string, sourceKind: string): boolean {
  if (sourceKind === "x_search" || sourceKind === "mp_account") return false;
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) && !/(^|\.)(x\.com|twitter\.com|mp\.weixin\.qq\.com)$/i.test(u.hostname);
  } catch {
    return false;
  }
}

/** Fetches and stores the body of one article. Unconfirmed bodies are recorded as such. */
export async function extractArticleBody(articleId: string, allowJina = process.env.JINA_BODY_FALLBACK !== "false"): Promise<"ok" | "unconfirmed" | "skipped"> {
  const [a] = await sql<{ id: string; url: string; body_status: string; revision: number; x_post: { tweetId?: string } | null; config: { body?: BodyRules } }[]>`
    SELECT a.id, a.url, a.body_status, a.revision, a.x_post, s.config FROM articles a JOIN sources s ON s.id = a.source_id WHERE a.id = ${articleId}`;
  if (!a || a.body_status === "ok") return "skipped";
  if (a.x_post?.tweetId) return extractXArticle(a.id, a.x_post.tweetId);
  const got = await extractFromUrl(a.url, { allowJina, subject: `article:${a.id}`, body: a.config.body });
  if (!got) {
    await sql`UPDATE articles SET body_status = 'unconfirmed', updated_at = now() WHERE id = ${articleId} AND body_status <> 'ok'`;
    return "unconfirmed";
  }
  // The body is new content: a new revision, so an analysis of the body-less input counts as stale.
  await sql.begin(async (tx) => {
    const [row] = await tx<{ title: string; excerpt: string | null }[]>`SELECT title, excerpt FROM articles WHERE id = ${articleId} FOR UPDATE`;
    if (!row) return;
    const hash = contentHash({ title: row.title, bodyText: got.text, excerpt: row.excerpt });
    const [r] = await tx<{ revision: number }[]>`
      UPDATE articles SET body_html = ${got.html}, body_text = ${got.text}, body_status = 'ok',
        media = ${tx.json(got.images as never)}::jsonb,
        revision = revision + 1, content_hash = ${hash}, processing_state = 'new', updated_at = now()
      WHERE id = ${articleId} RETURNING revision`;
    await tx`INSERT INTO article_revisions (article_id, revision, content_hash, title, body_text)
             VALUES (${articleId}, ${r!.revision}, ${hash}, ${row.title}, ${got.text})`;
  });
  return "ok";
}

/**
 * The X Article a post published (SocialData, paid, by the post's own id). The article joins the
 * post's body as a new revision; a post that is only the article's link takes the article's title.
 * No article (the link points at someone else's, or X has none) leaves the post "unconfirmed", and
 * the judging steps are told the article was not fetched.
 */
async function extractXArticle(articleId: string, tweetId: string): Promise<"ok" | "unconfirmed"> {
  const found = await getArticle(tweetId, { purpose: "x_article", subject: `article:${articleId}` });
  const got = found ? xArticleText(found) : null;
  if (!got) {
    await sql`UPDATE articles SET body_status = 'unconfirmed', updated_at = now() WHERE id = ${articleId} AND body_status <> 'ok'`;
    return "unconfirmed";
  }
  await sql.begin(async (tx) => {
    const [row] = await tx<{ title: string; excerpt: string | null; body_text: string | null; x_post: { text?: string } | null }[]>`
      SELECT title, excerpt, body_text, x_post FROM articles WHERE id = ${articleId} FOR UPDATE`;
    if (!row) return;
    const title = got.title && onlyXArticleLink(row.x_post?.text) ? got.title : row.title;
    const bodyText = [row.body_text ?? "", got.title ? `# ${got.title}` : "", got.text].filter(Boolean).join("\n\n");
    const hash = contentHash({ title, bodyText, excerpt: row.excerpt });
    const [r] = await tx<{ revision: number }[]>`
      UPDATE articles SET title = ${title}, body_text = ${bodyText}, x_article = ${tx.json(got as never)}, body_status = 'ok',
        revision = revision + 1, content_hash = ${hash}, processing_state = 'new', updated_at = now()
      WHERE id = ${articleId} RETURNING revision`;
    await tx`INSERT INTO article_revisions (article_id, revision, content_hash, title, body_text)
             VALUES (${articleId}, ${r!.revision}, ${hash}, ${title}, ${bodyText})`;
  });
  return "ok";
}

export { collapseWhitespace };
