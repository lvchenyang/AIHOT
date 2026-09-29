import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CATEGORIES, CATEGORY_TAGS, CATEGORY_BY_ITEM_TYPE, ENTITY_TAGS, ENTITIES, ITEM_TYPES, TOPIC_TAGS } from "@aihot/industry/taxonomy";
import { FEATURES } from "@aihot/industry/features";
import { assertSupportedConfig } from "@aihot/backend/sources/config-keys";
import { fromHtml } from "@aihot/backend/sources/web-list";
import { enforceIdentity } from "@aihot/backend/editorial/writing";
import { promptText } from "@aihot/backend/editorial/prompts";
import type { SourceRow } from "@aihot/backend/sources/types";

const sources = JSON.parse(readFileSync(new URL("../industry/sources.json", import.meta.url), "utf8")).sources as SourceRow[];
const source = (id: string) => sources.find(s => s.id === id)!;

test("industry prompts, topics and source contracts use the same LNG vocabulary", () => {
  const understanding = promptText("content-understanding");
  const score = promptText("selection-score");
  for (const type of ITEM_TYPES) {
    assert.ok(understanding.includes(`\`${type}\``), type);
    assert.ok(score.includes(`| ${type} |`), type);
    assert.ok(CATEGORY_TAGS.includes(CATEGORY_BY_ITEM_TYPE[type] as never), type);
  }
  for (const tag of [...CATEGORY_TAGS, ...TOPIC_TAGS, ...ENTITY_TAGS]) assert.ok(understanding.includes(tag), tag);
  const topics = JSON.parse(readFileSync(new URL("../industry/topics.json", import.meta.url), "utf8")).topics;
  const slugs = new Set(topics.map((t: any) => t.slug));
  assert.equal(slugs.size, topics.length);
  for (const t of topics) {
    assert.ok(Array.isArray(t.tags), `${t.slug}: tags are required by seedTopics`);
    assert.ok(["company", "field", "genre"].includes(t.group));
    assert.ok(t.name && t.definition);
    if (t.entityId) assert.ok(ENTITIES[t.entityId]);
    for (const tag of t.tags ?? []) assert.ok([...CATEGORY_TAGS, ...TOPIC_TAGS, ...ENTITY_TAGS].includes(tag));
    for (const related of t.related ?? []) assert.ok(slugs.has(related), related);
  }
  assert.equal(new Set(sources.map(s => s.id)).size, sources.length);
  for (const s of sources) {
    assertSupportedConfig(s.kind, s.config);
    assert.equal((s as any).site_fulltext, false);
    assert.equal((s as any).syndicate_fulltext, false);
    if (s.kind === "external") assert.deepEqual([s.enabled, s.participation_mode], [false, "isolated"]);
  }
  assert.equal(source("web-shpgx-notices").enabled, false, "commercial reuse permission is still pending");
  assert.deepEqual(Object.values(FEATURES), [false, false]);
  assert.equal(CATEGORIES.length, 7);
});

test("LNG168 parser ignores sidebar promotions and retains the quote publication time", () => {
  const s = source("web-lng168");
  const html = `<aside><a href="/gateWay/newsDetail?id=1">平台广告</a></aside>
    <div class="new-list"><div class="news-title"><a href="/gateWay/newsDetail?id=2">某地LNG出厂报价</a></div>
    <div class="news-date"><span><span class="padding-left-5">2026-09-29 10:39:44</span></span><span>浏览999次</span></div></div>`;
  const items = fromHtml(html, s.config.url, s);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.url, "https://www.lng168.com/gateWay/newsDetail?id=2");
  assert.equal(items[0]!.title, "某地LNG出厂报价");
  assert.ok(items[0]!.publishedAt);
});

test("CNPC listing uses its dated news rows rather than navigation or undated homepage links", () => {
  const s = source("web-cnpc-news");
  const items = fromHtml(`<a href="/cnpcnews/ktkf/">油气</a>
    <li class="ejli"><a href="http://news.cnpc.com.cn/system/2026/09/29/test.shtml">某井进入试气阶段</a><span class="fr as07">2026-09-29</span></li>`, s.config.url, s);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.title, "某井进入试气阶段");
  assert.ok(items[0]!.publishedAt);
  assert.match(items[0]!.url, /^https:\/\/news\.cnpc\.com\.cn\/system\//);
});

test("identity guard accepts translated gas companies and rejects a different operator", () => {
  const material = { title: "Sinopec starts a gas well", text: "Sinopec announced gas well production.", sourceKind: "rss" };
  assert.equal(enforceIdentity(material, { titleZh: "中国石油化工气井投产", summaryZh: "中国石化宣布气井投产。" }).identityGuard.outcome, "pass");
  assert.equal(enforceIdentity(material, { titleZh: "中国石油气井投产", summaryZh: "中国石油宣布新气源。" }).identityGuard.outcome, "fallback");
});
