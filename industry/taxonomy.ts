// LNG 与天然气行业词表。分类已由用户确认；key 上线后保持稳定。
export const CATEGORIES = [
  { key: "prices", label: "价格行情", section: "价格行情", guide: "天然气与 LNG 出厂、挂牌、送到、进口到岸价格，以及 JKM、TTF、Henry Hub 和气价价差；保留日期与口径。运费归运输与设施" },
  { key: "domestic-supply", label: "气源与项目", section: "气源与项目", guide: "国内外液厂、液化项目、井口、气田、页岩气、煤层气的发现、审批、建设、试产、投产、检修、停复产；保留所在地、项目名和实际阶段。接收站、管网、储气库项目归运输与设施" },
  { key: "logistics", label: "运输与设施", section: "运输与设施", guide: "LNG 船舶、航线、运费、槽车、限行、港口、接收站、管网、储气库的建设与运行，以及停航、堵港、检修和运力变化。全国或地区库存统计归供需与库存" },
  { key: "supply-demand", label: "供需与库存", section: "供需与库存", guide: "国内外产量、消费、进口出口、库存、气电需求、天气、供需平衡及有依据的价格驱动分析。单个气田和液厂的项目进度归气源与项目" },
  { key: "industry", label: "采购与合同", section: "采购与合同", guide: "天然气采购招标、竞价、成交、长协、现货货单、供气合同、交付和结算；工程设备招标按对应项目或设施分类，不把泛公司动态和无天然气交易事实的新闻放入本类" },
  { key: "policy", label: "政策监管", section: "政策监管", guide: "天然气监管、价格机制、市场准入、管网公平开放、保供储备、安全环保、税费补贴及地方实施细则；包含征求意见、正式文件和政策解读，保留发文机关、文号、地区和生效时间。单个项目审批按项目类型归类，采购成交归采购与合同，国际冲突制裁归国际局势" },
  { key: "geopolitics", label: "国际局势", section: "国际局势", guide: "与天然气供应或贸易有具体关联的冲突、制裁、关税、出口限制和外交变化；不把可能影响写成已发生涨跌。普通海外项目和合同分别归气源与项目、采购与合同" },
] as const;

// 与 selection-score.md 的七类权重表、content-understanding.md 同步。
export const ITEM_TYPES = ["price_update", "supply_project", "logistics_update", "market_report", "industry_event", "opinion_analysis", "tutorial_explainer"] as const;
export const CATEGORY_TAGS = ["价格行情", "气源项目", "运输物流", "供需数据", "国际局势", "政策监管", "贸易交易", "市场分析", "贸易实务", "行业动态", "其他"] as const;
export const TOPIC_TAGS = [
  "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川", "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆", "国际", "管网", "储气库", "审批", "开工", "试产", "正式投产", "检修", "停产", "复产",
  "LNG", "管道气", "液厂", "井口", "气田", "页岩气", "煤层气", "试产投产", "检修停复产", "接收站", "槽车", "LNG船", "运费", "航道", "长协", "现货", "出厂价", "到岸价", "送到价", "JKM", "TTF", "Henry Hub", "库存", "进口出口", "气电需求", "天气", "制裁关税", "中国大陆", "华北", "西北", "西南", "华东", "华南", "东北", "中东", "欧洲", "美国", "亚太",
] as const;
export const ENTITY_TAGS = ["中国石油", "中国石化", "中国海油", "国家管网", "延长石油", "广汇能源", "新奥", "卡塔尔能源", "Cheniere", "Shell", "TotalEnergies", "EIA", "IEA", "国家能源局"] as const;

export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  液化天然气: "LNG", lng: "LNG", 工厂: "液厂", 液化厂: "液厂", 气井: "井口", 新井: "井口",
  投产: "正式投产", 试生产: "试产",
  价格: "价格行情", 报价: "价格行情", 涨跌: "价格行情", 运输: "运输物流", 航运: "运输物流",
  政策: "政策监管", 监管: "政策监管", 法规: "政策监管", 招标: "贸易交易", 成交: "贸易交易", 采购: "贸易交易",
  分析: "市场分析", 观点: "市场分析", 教程: "贸易实务", 指南: "贸易实务", 行业: "行业动态",
  中石油: "中国石油", cnpc: "中国石油", petrochina: "中国石油", 中石化: "中国石化", sinopec: "中国石化",
  中海油: "中国海油", cnooc: "中国海油", pipechina: "国家管网", qatarenergy: "卡塔尔能源", 壳牌: "Shell", 道达尔能源: "TotalEnergies",
};
export const CATEGORY_BY_ITEM_TYPE: Readonly<Record<string, string>> = {
  price_update: "价格行情", supply_project: "气源项目", logistics_update: "运输物流", market_report: "供需数据",
  industry_event: "行业动态", opinion_analysis: "市场分析", tutorial_explainer: "贸易实务",
};

export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[] }> = {
  cnpc: { name: "中国石油", displayTag: "中国石油", aliases: ["中国石油", "中石油", "CNPC", "PetroChina"] },
  sinopec: { name: "中国石化", displayTag: "中国石化", aliases: ["中国石化", "中石化", "Sinopec"] },
  cnooc: { name: "中国海油", displayTag: "中国海油", aliases: ["中国海油", "中海油", "CNOOC"] },
  pipechina: { name: "国家管网", displayTag: "国家管网", aliases: ["国家管网", "PipeChina"] },
  yanchang: { name: "延长石油", displayTag: "延长石油", aliases: ["延长石油", "Yanchang Petroleum"] },
  guanghui: { name: "广汇能源", displayTag: "广汇能源", aliases: ["广汇能源", "Guanghui Energy"] },
  enn: { name: "新奥", displayTag: "新奥", aliases: ["新奥", "ENN"] },
  qatarenergy: { name: "卡塔尔能源", displayTag: "卡塔尔能源", aliases: ["卡塔尔能源", "QatarEnergy", "Qatar Petroleum", "Qatargas"] },
  cheniere: { name: "Cheniere", displayTag: "Cheniere", aliases: ["Cheniere", "切尼尔"] },
  shell: { name: "Shell", displayTag: "Shell", aliases: ["Shell", "壳牌"] },
  totalenergies: { name: "TotalEnergies", displayTag: "TotalEnergies", aliases: ["TotalEnergies", "道达尔能源"] },
  eia: { name: "美国能源信息署", displayTag: "EIA", aliases: ["EIA", "美国能源信息署", "Energy Information Administration"] },
  iea: { name: "国际能源署", displayTag: "IEA", aliases: ["IEA", "国际能源署", "International Energy Agency"] },
  nea: { name: "国家能源局", displayTag: "国家能源局", aliases: ["国家能源局", "National Energy Administration"] },
};

// 仅匹配明确的机构名，不把“液厂”“井口”或地名误当公司身份。
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "cnpc", name: "中国石油", patterns: [/中国石油(?!化工)|中石油|\bCNPC\b|\bPetroChina\b/i] },
  { id: "sinopec", name: "中国石化", patterns: [/中国石化|中国石油化工|中石化|\bSinopec\b/i] },
  { id: "cnooc", name: "中国海油", patterns: [/中国海油|中国海洋石油|中海油|\bCNOOC\b/i] },
  { id: "pipechina", name: "国家管网", patterns: [/国家管网|国家石油天然气管网|\bPipeChina\b/i] },
  { id: "yanchang", name: "延长石油", patterns: [/延长石油|\bYanchang Petroleum\b/i] },
  { id: "guanghui", name: "广汇能源", patterns: [/广汇能源|\bGuanghui Energy\b/i] },
  { id: "enn", name: "新奥", patterns: [/新奥|\bENN\b/i] },
  { id: "qatarenergy", name: "卡塔尔能源", patterns: [/卡塔尔能源|\bQatarEnergy\b|\bQatar Petroleum\b|\bQatargas\b/i] },
  { id: "cheniere", name: "Cheniere", patterns: [/\bCheniere\b|切尼尔/i] },
  { id: "shell", name: "Shell", patterns: [/\bShell\b|壳牌/i] },
  { id: "totalenergies", name: "TotalEnergies", patterns: [/\bTotalEnergies\b|道达尔能源/i] },
  { id: "eia", name: "美国能源信息署", patterns: [/\bEIA\b|美国能源信息署|Energy Information Administration/i] },
  { id: "iea", name: "国际能源署", patterns: [/\bIEA\b|国际能源署|International Energy Agency/i] },
  { id: "nea", name: "国家能源局", patterns: [/国家能源局|National Energy Administration/i] },
];
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "cnpc", domains: ["cnpc.com.cn", "petrochina.com.cn"] },
  { entityId: "sinopec", domains: ["sinopec.com"] },
  { entityId: "cnooc", domains: ["cnooc.com.cn"] },
  { entityId: "pipechina", domains: ["pipechina.com.cn"] },
  { entityId: "qatarenergy", domains: ["qatarenergy.qa", "qatarenergylng.qa"] },
  { entityId: "cheniere", domains: ["cheniere.com"] },
  { entityId: "shell", domains: ["shell.com"] },
  { entityId: "totalenergies", domains: ["totalenergies.com"] },
  { entityId: "eia", domains: ["eia.gov"] },
  { entityId: "iea", domains: ["iea.org"] },
  { entityId: "nea", domains: ["nea.gov.cn"] },
];
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [];

/** 主题目录分组文案。 */
export const TOPIC_GROUPS = [
  { key: "company", name: "公司与机构", blurb: "跟进气源企业、贸易商和行业机构的动态" },
  { key: "field", name: "关注方向", blurb: "查看价格、液厂、井口、运输、供需和国际风险" },
  { key: "genre", name: "内容形态", blurb: "按数据报告、市场分析和贸易实务浏览" },
] as const;
