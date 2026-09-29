import { POLICY } from "@aihot/industry/site";
import { Link, useLoaderData, useNavigation } from "react-router";
import type { Route } from "./+types/policy";
import type { PoolResponse } from "@aihot/contracts/site";
import { loadOr404, queryString } from "../lib/api.server";
import { listPath, pageMeta } from "../lib/seo";
import { SearchField } from "../features/feed/Filters";
import { DayList, Pagination } from "../features/feed/DayList";
import { PillTabs } from "../components/ui/Tabs";
import { EmptyState } from "../components/ui/Page";

export async function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const channel = params.get("channel") === "firstParty" ? "firstParty" : "all";
  const q = params.get("q")?.trim().slice(0, 200) || null;
  const page = Math.min(Math.max(Number.parseInt(params.get("page") ?? "1", 10) || 1, 1), 50);
  const data = await loadOr404<PoolResponse>(
    `/api/site/pool${queryString({ category: "policy", channel, q, page })}`,
    { signal: request.signal, busyRedirect: "/all/search-busy" },
  );
  return { data };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const data = loaderData?.data;
  return pageMeta({
    title: data?.filters.q ? `政策搜索：${data.filters.q}` : POLICY.title,
    description: POLICY.description,
    path: listPath("/policy", { channel: data?.filters.channel === "firstParty" ? "firstParty" : null, q: data?.filters.q, page: data && data.page > 1 ? data.page : null }),
    noindex: !!data?.filters.q,
  });
}

export function headers() {
  return { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=30" };
}

export default function PolicyPage() {
  const { data } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const f = data.filters;
  const busy = navigation.state === "loading" && navigation.location?.pathname === "/policy";
  const href = (channel: string, page = 1) => listPath("/policy", { channel: channel === "firstParty" ? channel : null, q: f.q, page: page > 1 ? page : null });
  return (
    <div className="pb-6">
      <header className="pb-5 pt-5 lg:pt-1">
        <h1 className="text-[24px] font-semibold leading-[1.3] text-ink">{POLICY.title}</h1>
        <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ink-3">{POLICY.description}</p>
      </header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <PillTabs label="政策来源" layoutId="policy-sources" active={f.channel} items={[
          { key: "all", label: "全部政策", to: href("all") },
          { key: "firstParty", label: "一手发布", to: href("firstParty") },
        ]} />
        <SearchField action="/policy" defaultValue={f.q ?? ""} keep={{ channel: f.channel === "firstParty" ? f.channel : null }} />
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-4">
        <span>{f.q ? `政策中搜索“${f.q}”` : "最新动态"} · {data.total >= 2000 ? "2000+" : data.total} 条</span>
        <a href="/feed/category/policy.xml" className="text-accent hover:underline">订阅政策精选 RSS</a>
      </div>
      <div className={`transition-opacity duration-200 ${busy ? "opacity-50" : ""}`}>
        {data.items.length ? <DayList items={data.items} todayCount={f.q ? null : data.todayCount} showTags /> : (
          <div className="card">
            <EmptyState title={f.q ? "没有找到相关政策" : "暂未收录政策"} action={f.q ? <Link to="/policy" className="text-accent hover:underline">查看全部政策</Link> : undefined}>
              {f.q ? "换个关键词，或查看全部政策。" : POLICY.empty}
            </EmptyState>
          </div>
        )}
      </div>
      <Pagination page={data.page} pageCount={data.pageCount} href={(page) => href(f.channel, page)} />
    </div>
  );
}
