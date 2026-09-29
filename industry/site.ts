// 站点身份和读者看得到的文案。换成你的行业时，先改这个文件。
// 网页和后端都读它；改完重新构建（docker compose up --build）即可生效。
// 域名不在这里：部署时用环境变量 SITE_URL 设置。

export const SITE = {
  /** 站名：导航、页面标题、分享图、RSS、MCP、后台都用它。 */
  name: "气市观察",
  /**
   * 行业词：拼进默认说法里，比如“天然气日报”“天然气动态”。
   * 改成“法律”“HR”“黄金”之类，页面上就会变成“法律日报”“法律动态”。
   */
  subject: "天然气",
  /** 首页的完整标题（浏览器标签、搜索结果）。 */
  homeTitle: "气市观察 — 价格、气源、运输与国际动态",
  /** 一句话介绍：搜索引擎、分享卡片、RSS、llms.txt 会用。 */
  description: "关注 LNG 与天然气价格、国内液厂和气井、运输与接收站，以及影响贸易和供需的国际局势。每条信息保留原文链接。",
  /** 首页左上角和侧边栏下面的一行小字。 */
  tagline: "关注气源与市场",
  /** 界面语言（HTML lang、og:locale）。 */
  locale: "zh-CN",
  /** 默认域名，只在没设置 SITE_URL 时使用。 */
  defaultUrl: "http://localhost:3000",
  /**
   * MCP 工具名的前缀（小写字母、数字、下划线），工具会叫 myhot_get_latest、myhot_search……
   * 已经有人接入后就不要再改。
   */
  mcpPrefix: "disongas",
  /** 对外联系邮箱（选填）：使用规则、llms.txt、响应头里会写。 */
  contactEmail: null as string | null,
  /** 页脚的一行小字（选填）。 */
  footerNote: "LNG 与天然气行业资讯",
  /** 中国大陆网站的 ICP 备案号（选填），填了就显示在页脚并链接到工信部备案系统。 */
  icp: null as string | null,
  /** 结构化数据里的网站运营者（搜索引擎用）。 */
  organization: {
    name: "气市观察",
    /** 创始人（选填）：{ name, url, description }。 */
    founder: null as null | { name: string; url?: string; description?: string },
  },
  /** 抓取信源时报上的名字（User-Agent 里用），不要冒用别的站。 */
  crawlerName: "DisonGasBot",
} as const;

/** 政策栏目的读者文案。 */
export const POLICY = {
  title: "政策",
  description: "跟进天然气监管、价格机制、市场准入、管网开放、保供储备和地方实施细则。区分征求意见、正式文件与政策解读，保留发文机关、适用地区和生效时间。",
  empty: "收录的天然气政策会显示在这里，可查看来源和原文。",
} as const;

/** 关于页的文案。数字（信源数、收录数、精选数、日报期数）来自站内实时统计，不用写在这里。 */
export const ABOUT = {
  kicker: `关于 ${SITE.name}`,
  /** 大标题：第一行正常颜色，第二行强调色。 */
  headline: ["气源、价格和运输的变化，", "放在一起看。"] as [string, string],
  /** 标题下面的一段话。{sources} 会换成实时的信源数。 */
  lead: `${SITE.name} 关注 {sources} 个信源中的 LNG 与天然气信息：从国内液厂、气井的新进展，到国际供应、航运和价格变化。按事件整理，保留出处，提供每日阅读。`,
  /** 信源河动画下面的四个环节。 */
  steps: {
    collect: "从政府、行业机构、企业公告和专业媒体获取信息，分别标明出处与发布时间。",
    store: "同一事件的报道归到一起；不同地区、不同日期的报价，以及不同液厂和井口，分别记录。",
    select: "关注有具体地点和进度的新增气源，以及价格、运费、库存和供应变化。国际消息需与天然气贸易有关。",
    publish: "按日、周、月整理动态，提供网页、RSS、公开 API 和 MCP。报价保留原始口径，详情请核对原文。",
  },
  /**
   * 作者块（选填），null 就不显示。
   * avatarSourceId：一个 X 账号信源的 id，头像取它的（选填）。
   * 二维码在后台“设置”里上传，或者放进 industry/brand/contact/；没有二维码就不显示那张卡片。
   */
  maker: null as null | {
    name: string;
    greeting: string[];
    avatarSourceId?: string | null;
    wechat?: { title: string; note: string };
    feishu?: { title: string; note: string };
  },
  /** 页面底部的版权与下架说明（结尾会接“反馈页”的链接）。 */
  copyright: `${SITE.name} 是聚合摘要和阅读索引，原文版权归各来源所有。如果你是来源方，希望更正、下架或调整展示方式，可以通过`,
} as const;

/** “天然气日报”这类说法：行业词和名词之间，英文词加空格，中文词不加。 */
export function withSubject(noun: string): string {
  return /[A-Za-z0-9]$/.test(SITE.subject) ? `${SITE.subject} ${noun}` : `${SITE.subject}${noun}`;
}
