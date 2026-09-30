// Clean body → Markdown; the web and RSS keep their safe HTML projection of the same content.
import * as cheerio from "cheerio";
import { marked } from "marked";
import TurndownService from "turndown";
import { sanitizeBody, trimTrailingChrome } from "./sanitize.ts";

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
// Markdown has no equivalent for these structures. Retain safe HTML instead of losing units or media.
turndown.keep(["sup", "sub", "u", "mark", "dl", "video"]);
turndown.addRule("strikethrough", { filter: ["del", "s"], replacement: (content) => `~~${content}~~` });
turndown.addRule("table", {
  filter: "table",
  replacement: (_content, node) => {
    const outerHtml = (node as unknown as { outerHTML: string }).outerHTML;
    const $ = cheerio.load(outerHtml, null, false);
    const table = $("table").first();
    const rows = table.find("tr").toArray();
    if (!rows.length) return "";
    const width = $(rows[0]!).children("th, td").length;
    const complex = table.find("table, [rowspan], [colspan]").length > 0 ||
      !width || $(rows[0]!).children("th").length !== width ||
      rows.some((row) => $(row).children("th, td").length !== width);
    // Merged cells and tables without headings cannot be faithfully represented as a GFM table.
    if (complex) return `\n\n${outerHtml}\n\n`;
    const cells = (row: (typeof rows)[number]) => $(row).children("th, td").toArray().map((cell) =>
      turndown.turndown($(cell).html() ?? "").trim().replace(/\|/g, "\\|").replace(/\s*\n\s*/g, "<br>"));
    const line = (values: string[]) => `| ${values.join(" | ")} |`;
    const align = $(rows[0]!).children("th").toArray().map((cell) => {
      const value = $(cell).attr("align");
      return value === "right" ? "---:" : value === "center" ? ":---:" : value === "left" ? ":---" : "---";
    });
    const caption = table.children("caption").html();
    return `\n\n${caption ? `${turndown.turndown(caption)}\n\n` : ""}${[line(cells(rows[0]!)), line(align), ...rows.slice(1).map((row) => line(cells(row)))].join("\n")}\n\n`;
  },
});

export function bodyToMarkdown(html: string, baseUrl?: string): string {
  return turndown.turndown(trimTrailingChrome(sanitizeBody(html, baseUrl))).trim();
}

export function markdownToBody(markdown: string, baseUrl?: string): string {
  return trimTrailingChrome(sanitizeBody(marked.parse(markdown, { async: false, gfm: true }), baseUrl));
}
