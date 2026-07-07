import { getAirport } from "./airports";

export interface FaqItem {
  q: string;
  a: string;
  type: "baggage" | "visa";
  warning?: boolean;
}

// 机场三字码到国家/地区的映射
const AIRPORT_COUNTRIES: Record<string, { country: string; visaInfo: string; transitInfo: string }> = {
  SIN: {
    country: "新加坡",
    visaInfo: "🇸🇬 持中国护照免签入境（停留最长30天）。出发前需在抵达前3天内填报新加坡电子入境卡（SG Arrival Card）。",
    transitInfo: "新加坡樟宜国际机场（SIN）提供极佳的转机体验。如果是联程机票直接走国际转机区无须签证；如果是自中转需要出关，由于中新免签，您可凭中国普通护照直接出关办理重新托运。",
  },
  HKG: {
    country: "中国香港",
    visaInfo: "🇭🇰 凭中国护照持有效的联程机票经香港转机前往第三国（或从第三国返回），免签入境逗留最多7天，无需港澳通行证签注。",
    transitInfo: "香港国际机场（HKG）支持无签证直接转机。如果需要出海关自中转，持护照及前往第三国的联程机票可获得7天免签入境待遇，无需另外申请签注。",
  },
  MFM: {
    country: "中国澳门",
    visaInfo: "🇲🇴 凭中国护照持有效的联程机票经澳门转机前往第三国（或从第三国返回），免签入境逗留最多7天，无需港澳通行证签注。",
    transitInfo: "澳门国际机场（MFM）支持直接转机。如需要出海关自中转，持护照及前往第三国的机票可获得7天免签过境待遇。",
  },
  TPE: {
    country: "中国台湾",
    visaInfo: "🇹🇼 大陆居民前往台湾转机或入境规则极严格。大陆出发直飞经台湾转机，须持有《大陆居民往来台湾通行证》及对应转机签注。如从第三国出发经台湾转机则较宽松，请提前与航司做最终确认。",
    transitInfo: "台湾桃园国际机场（TPE）转机对于从大陆出发的旅客通常需要大通证。若属于自中转，需要入关提取行李，目前大陆籍旅客较难直接入境，强烈建议避免在台湾自中转。",
  },
  TSA: {
    country: "中国台湾",
    visaInfo: "🇹🇼 大陆居民前往台湾转机或入境规则极严格。大陆出发直飞经台湾转机，须持有《大陆居民往来台湾通行证》及对应转机签注。如从第三国出发经台湾转机则较宽松，请提前与航司做最终确认。",
    transitInfo: "台湾台北松山机场转机对于从大陆出发的旅客通常需要大通证。若是自中转，需要出海关重新托运，强烈建议避免在此地自中转。",
  },
  KHH: {
    country: "中国台湾",
    visaInfo: "🇹🇼 大陆居民前往台湾转机或入境规则极严格。大陆出发直飞经台湾转机，须持有《大陆居民往来台湾通行证》及对应转机签注。如从第三国出发经台湾转机则较宽松，请提前与航司做最终确认。",
    transitInfo: "高雄国际机场（KHH）同理，强烈建议大陆居民避免在台湾自中转。",
  },
  BKK: {
    country: "泰国",
    visaInfo: "🇹🇭 自2024年3月起中泰互免签证，持中国护照前往泰国可以免签入境，停留最长30天。",
    transitInfo: "曼谷素万那普国际机场（BKK）支持免签证在国际转机区直接转机。如果需要出海关自中转提取行李，由于中泰免签，您可凭护照免签入境，直接出海关办理重新托运。",
  },
  DMK: {
    country: "泰国",
    visaInfo: "🇹🇭 自2024年3月起中泰互免签证，持中国护照前往泰国可以免签入境，停留最长30天。",
    transitInfo: "曼谷廊曼国际机场（DMK）支持直接转机。如果需要出关重新托运，可凭中国护照免签直接办理。",
  },
  CNX: {
    country: "泰国",
    visaInfo: "🇹🇭 中泰互免签证，持中国普通护照可以免签入境泰国停留最长30天。",
    transitInfo: "清迈机场转机，如涉及自中转出关，可利用免签政策办理。",
  },
  HKT: {
    country: "泰国",
    visaInfo: "🇹🇭 中泰互免签证，持中国普通护照可以免签入境泰国停留最长30天。",
    transitInfo: "普吉机场转机，如涉及自中转出关，可利用免签政策直接出关。",
  },
  KUL: {
    country: "马来西亚",
    visaInfo: "🇲🇾 马来西亚对中国公民实施免签入境30天政策。出发前需在抵达前3天内填报马来西亚电子入境卡（MDAC）。",
    transitInfo: "吉隆坡国际机场（KUL）是免签过境的枢纽。若需要出关提取行李重新托运，直接凭护照免签入关即可，非常便利。",
  },
  PEN: {
    country: "马来西亚",
    visaInfo: "🇲🇾 马来西亚对中国公民实施免签入境30天政策。出发前需在抵达前3天内填报马来西亚电子入境卡（MDAC）。",
    transitInfo: "槟城国际机场（PEN）转机，如涉及出关自中转，直接利用免签政策入关。",
  },
  MNL: {
    country: "菲律宾",
    visaInfo: "🇵🇭 前往菲律宾通常需要提前申请菲律宾旅游签证。持中国护照有有效的美签、申根签证、日签或加签等，可在符合条件下免签入境7天（仅供参考，转机出关请谨慎）。",
    transitInfo: "马尼拉机场（MNL）转机政策复杂，且不同航司可能使用不同航站楼。没有菲律宾签证的情况下，严禁自中转（无法出关提行李重新托运）。直接转机亦需同航站楼联程机票才稳妥。",
  },
  CEB: {
    country: "菲律宾",
    visaInfo: "🇵🇭 需提前办妥菲律宾旅游签证。",
    transitInfo: "宿务机场（CEB）转机。非联程机票如无菲律宾签证，将无法出关提取行李重新值机。",
  },
  SGN: {
    country: "越南",
    visaInfo: "🇻🇳 需要提前办理越南签证或申请电子签证（E-Visa）。",
    transitInfo: "胡志明市新山一机场（SGN）直接转机不需要签证。但如果是自中转需要出关提行李，**必须**提前办妥有效的越南签证/电子签，否则无法出关取行李。",
  },
  HAN: {
    country: "越南",
    visaInfo: "🇻🇳 需要提前办理越南签证或申请电子签证（E-Visa）。",
    transitInfo: "河内内排机场（HAN）同理，不出转机区无须签证，如需出海关自中转，必须办妥越南签证/电子签。",
  },
  DAD: {
    country: "越南",
    visaInfo: "🇻🇳 需要提前办理越南签证或申请电子签证（E-Visa）。",
    transitInfo: "岘港机场同理，自中转提取行李必须有越南签证。",
  },
  CGK: {
    country: "印度尼西亚",
    visaInfo: "🇮🇩 需办理落地签证（VOA）或提前申请电子落地签证（e-VOA），费用约为 500,000 印尼盾，可停留30天。",
    transitInfo: "雅加达机场（CGK）直接同区域转机不需要签证。若是自中转，需要出海关，必须在机场办理落地签（VOA）后才能入境提取行李重新托运。",
  },
  DPS: {
    country: "印度尼西亚",
    visaInfo: "🇮🇩 需办理落地签证（VOA，可停留30天）。",
    transitInfo: "巴厘岛伍拉·赖机场（DPS）自中转，必须在海关处付费办理落地签才能入境提取行李。",
  },
  RGN: {
    country: "缅甸",
    visaInfo: "🇲🇲 需提前办理电子签（E-Visa）或满足落地签条件。",
    transitInfo: "仰光机场（RGN）转机，如涉及自中转，必须有缅甸签证/电子签。",
  },
  PNH: {
    country: "柬埔寨",
    visaInfo: "🇰🇭 可以办理落地签证（VOA）或提前申请电子签证。",
    transitInfo: "金边机场（PNH）转机。如涉及自中转重新托运，可在机场申请办理落地签证入境。",
  },
  REP: {
    country: "柬埔寨",
    visaInfo: "🇰🇭 可以办理落地签证（VOA）或提前申请电子签证。",
    transitInfo: "暹粒机场（REP）转机。如涉及自中转重新托运，可在机场办理落地签证入境。",
  },
  VTE: {
    country: "老挝",
    visaInfo: "🇱🇦 可以办理落地签证或提前办理老挝签证。",
    transitInfo: "万象瓦岱机场（VTE）转机，自中转可办理落地签证入境。",
  },
  BWN: {
    country: "文莱",
    visaInfo: "🇧🇳 可以办理落地签证（停留最多14天）。",
    transitInfo: "文莱国际机场（BWN）转机，自中转可办理落地签证入境以重新托运。",
  },
  DEL: {
    country: "印度",
    visaInfo: "🇮🇳 持中国护照前往印度需提前办理有效的纸质签证或电子签证，目前中国公民电子签证审理较为严格，建议提早申请。",
    transitInfo: "新德里机场（DEL）转机，直接转机（不超过24小时且在转机区域内）无需签证。但严禁在没有印签的情况下自中转，因为无法入境提取行李重新值机。",
  },
  BOM: { country: "印度", visaInfo: "🇮🇳 需提前办妥印度签证。", transitInfo: "孟买机场同理，无印度签证者无法进行自中转（分开出票）操作。" },
  BLR: { country: "印度", visaInfo: "🇮🇳 需提前办妥印度签证。", transitInfo: "班加罗尔机场同理，无印签严禁自中转。" },
  MAA: { country: "印度", visaInfo: "🇮🇳 需提前办妥印度签证。", transitInfo: "金奈机场同理，无印签严禁自中转。" },
  CCU: { country: "印度", visaInfo: "🇮🇳 需提前办妥印度签证。", transitInfo: "加尔各答机场同理，无印签严禁自中转。" },
  CMB: {
    country: "斯里兰卡",
    visaInfo: "🇱🇰 斯里兰卡对中国普通护照实施免签/ETA电子许可（视具体政策而定，建议在官网免费申请 ETA 许可）。",
    transitInfo: "科伦坡机场（CMB）自中转，直接在线办理好免签 ETA 入境提行李重新托运即可。",
  },
  DAC: {
    country: "孟加拉国",
    visaInfo: "🇧🇩 可在达卡机场办理落地签证（需持特定邀请函或材料说明），建议提前办妥签证或准备好齐备材料。",
    transitInfo: "达卡机场（DAC）自中转，出海关较繁琐，建议避免在此地自中转。",
  },
  DXB: {
    country: "阿联酋",
    visaInfo: "🇦🇪 持中国普通护照免签入境阿联酋停留最长30天。",
    transitInfo: "迪拜国际机场（DXB）是国际大型枢纽，同航区或国际转机无须签证。由于中阿互免签证，如果遇到非联程自中转，可以直接凭护照无缝入境提行李，再次值机托运。",
  },
  AUH: {
    country: "阿联酋",
    visaInfo: "🇦🇪 持中国普通护照免签入境阿联酋停留最长30天。",
    transitInfo: "阿布扎比机场（AUH）同理，中阿互免签，自中转极其便利。",
  },
  DOH: {
    country: "卡塔尔",
    visaInfo: "🇶🇦 持中国普通护照免签入境卡塔尔停留最长30天。",
    transitInfo: "哈马德国际机场（DOH）是全球转机枢纽，直接转机无签证要求。若需要自中转，由于中卡免签，可以直接凭护照出关提取行李重新托运。",
  },
  IST: {
    country: "土耳其",
    visaInfo: "🇹🇷 需要提前办理土耳其电子签证（E-Visa）。",
    transitInfo: "伊斯坦布尔机场（IST）直接转机不需要签证。但是如果是自中转重新托运行李，**必须**提前在线办妥土耳其电子签证，才能入关提取行李并重新托运。",
  },
  TLV: {
    country: "以色列",
    visaInfo: "🇮🇱 需要提前办理以色列签证。",
    transitInfo: "本古里安机场（TLV）转机政策复杂，目前不建议在此自中转。",
  },
  LHR: {
    country: "英国",
    visaInfo: "🇬🇧 持中国普通护照前往英国需要提前申请签证。转机如果不出海关且在同日进行，在特定豁免条件下（如持美/加/欧/澳等国有效签证或永居证）可免签直接转机（Direct Airside Transit）。",
    transitInfo: "希思罗机场（LHR）如果是不出海关的联程机票转机，只要满足豁免条件无需签证。但由于英国没有对普通中国旅客无条件开放过境免签，**如果自中转要出关拿行李，必须提前申请英国过境签或正规旅游签证**。无有效签证无法出关提取行李！",
  },
  LGW: {
    country: "英国",
    visaInfo: "🇬🇧 需要提前申请英国签证或满足过境免签豁免条件。",
    transitInfo: "盖特威克机场（LGW）同理，无有效签证/未满足豁免条件严禁自中转。",
  },
  DUB: {
    country: "爱尔兰",
    visaInfo: "🇮🇪 需要提前办理爱尔兰签证。爱尔兰不属于申根区，英国签证在符合特定BIVS计划下可能通用。",
    transitInfo: "都柏林机场（DUB）自中转，必须持有有效的爱尔兰签证以办理入境提取行李手续。",
  },
  JFK: {
    country: "美国",
    visaInfo: "🇺🇸 持中国普通护照前往美国或经美国机场转机前往第三国，**都必须提前办妥美国签证（B1/B2 旅游签或 C-1 过境签）**。美国没有任何形式的转机免签证政策。",
    transitInfo: "纽约肯尼迪机场（JFK）没有设立免签转机区域。无论您是联程机票还是自中转，无论行李是否直挂，所有旅客到了美国机场**都必须出海关入境并提取行李重新过安检**。因此您**绝对必须持有美国签证**，否则无法登机。",
  },
  EWR: { country: "美国", visaInfo: "🇺🇸 无论入境还是转机，都必须持有美国签证。", transitInfo: "纽瓦克机场同理，没有过境免签政策，必须持有有效的美国签证。" },
  LAX: { country: "美国", visaInfo: "🇺🇸 无论入境还是转机，都必须持有美国签证。", transitInfo: "洛杉矶机场同理，没有过境免签政策，必须持有有效的美国签证。" },
  SFO: { country: "美国", visaInfo: "🇺🇸 无论入境还是转机，都必须持有美国签证。", transitInfo: "旧金山机场同理，没有过境免签政策，必须持有有效的美国签证。" },
  ORD: { country: "美国", visaInfo: "🇺🇸 无论入境还是转机，都必须持有美国签证。", transitInfo: "芝加哥机场同理，没有过境免签政策，必须持有有效的美国签证。" },
  ATL: { country: "美国", visaInfo: "🇺🇸 无论入境还是转机，都必须持有美国签证。", transitInfo: "亚特兰大机场同理，没有过境免签政策，必须持有有效的美国签证。" },
  DFW: { country: "美国", visaInfo: "🇺🇸 无论入境还是转机，都必须持有美国签证。", transitInfo: "达拉斯机场同理，没有过境免签政策，必须持有有效的美国签证。" },
  SEA: { country: "美国", visaInfo: "🇺🇸 无论入境还是转机，都必须持有美国签证。", transitInfo: "西雅图机场同理，没有过境免签政策，必须持有有效的美国签证。" },
  IAD: { country: "美国", visaInfo: "🇺🇸 无论入境还是转机，都必须持有美国签证。", transitInfo: "华盛顿杜勒斯机场同理，没有过境免签政策，必须持有有效的美国签证。" },
  MIA: { country: "美国", visaInfo: "🇺🇸 无论入境还是转机，都必须持有美国签证。", transitInfo: "迈阿密机场同理，没有过境免签政策，必须持有有效的美国签证。" },
  BOS: { country: "美国", visaInfo: "🇺🇸 无论入境还是转机，都必须持有美国签证。", transitInfo: "波士顿机场同理，没有过境免签政策，必须持有有效的美国签证。" },
  YVR: {
    country: "加拿大",
    visaInfo: "🇨🇦 持中国普通护照经加拿大转机，通常需要持有加拿大签证。满足“中国过境计划”（China Transit Program）的特定苛刻条件时可免过境签转机，但这不适用于自中转。",
    transitInfo: "温哥华国际机场（YVR）转机，联程且满足特定条件可免签直接转机。但对于**自中转需要出海关提行李的旅客，必须持有加拿大有效签证**，中国过境计划免签政策不适用于自中转旅客。",
  },
  YYZ: {
    country: "加拿大",
    visaInfo: "🇨🇦 通常需要加拿大签证，符合过境免签计划条件除外。",
    transitInfo: "多伦多皮尔逊机场（YYZ）同理，自中转出关提取行李的旅客必须持有加拿大的有效签证。",
  },
  SYD: {
    country: "澳大利亚",
    visaInfo: "🇦🇺 持中国普通护照经澳大利亚前往第三国（如新西兰），**必须提前在线申请获得澳大利亚过境签证（771类别）或普通访客签证**。没有直接免签转机政策。",
    transitInfo: "悉尼机场（SYD）转机，即使是联程且停留不超过8小时，普通中国护照持有者也**必须持有澳大利亚过境签证（771类）**才能转机。若属于自中转重新托运，则更需要有效的入境签证以出关提取行李。",
  },
  MEL: { country: "澳大利亚", visaInfo: "🇦🇺 经澳大利亚转机必须持有澳大利亚过境签证（771类）。", transitInfo: "墨尔本机场转机同理，必须持有有效的过境或旅游签证。" },
  BNE: { country: "澳大利亚", visaInfo: "🇦🇺 经澳大利亚转机必须持有澳大利亚过境签证（771类）。", transitInfo: "布里斯班机场转机同理，必须持有有效的过境或旅游签证。" },
  AKL: {
    country: "新西兰",
    visaInfo: "🇳🇿 持中国普通护照经新西兰机场前往第三国，需要申请过境签证（Transit Visa），除非持有澳大利亚有效签证等特定豁免件。",
    transitInfo: "奥克兰机场（AKL）转机，如果没有有效的澳大利亚签证，必须提前申请新西兰过境签证。若属于自中转，需出海关拿行李，则必须申请正规的新西兰旅游签证。",
  },
  JNB: {
    country: "南非",
    visaInfo: "🇿🇦 需提前申请南非签证或在线申请电子签证。",
    transitInfo: "约翰内斯堡机场（JNB）同航区直接转机不需要签证，但自中转出关则必须持有南非签证以进入到达区拿取行李。",
  },
  CAI: {
    country: "埃及",
    visaInfo: "🇪🇬 可办理落地签证（需持2000美金现金、回程机票及五星级酒店预订等，条件多变），建议提前在线办理电子签证。",
    transitInfo: "开罗国际机场（CAI）自中转，建议准备齐备的埃及落地签材料或提前办理好签证以确保顺利入境提行李。",
  },
  ADD: {
    country: "埃塞俄比亚",
    visaInfo: "🇪🇹 可以申请落地签或在线申请电子签（E-Visa）。",
    transitInfo: "博莱机场（ADD）是西非中转枢纽，直接转机免签证。自中转可以现场办理落地签证入境提行李。",
  },
  NBO: {
    country: "肯尼亚",
    visaInfo: "🇰🇪 前往肯尼亚需提前在线注册电子旅行授权（eTA），目前实行免签证费但需注册 eTA 的政策。",
    transitInfo: "内罗毕机场（NBO）转机，若自中转需要出海关，必须提前获得肯尼亚 eTA。",
  },
  GRU: { country: "巴西", visaInfo: "🇧🇷 需提前办妥巴西旅游签证。", transitInfo: "圣保罗机场（GRU）转机，自中转出关必须持有巴西签证。" },
  EZE: {
    country: "阿根廷",
    visaInfo: "🇦🇷 需要提前办理签证。如果持有有效期内的美国 B1/B2 签证或申根签证，可以申请阿根廷电子旅行授权（AVE）。",
    transitInfo: "布宜诺斯艾利斯机场（EZE）转机，自中转需出海关重新托运，必须有阿根廷签证或 AVE 电子授权。",
  },
  SCL: {
    country: "智利",
    visaInfo: "🇨🇱 持有中国普通护照且持有有效期6个月以上的美国或加拿大签证（过境签除外），可免签进入智利停留最多90天。否则需提前申请智利签证。",
    transitInfo: "圣地亚哥机场（SCL）自中转，必须符合免签政策（如持有有效美签/加签）或持有智利旅游签证，才能入境提行李重新托运。",
  },
  BOG: {
    country: "哥伦比亚",
    visaInfo: "🇨🇴 持中国普通护照且持有有效期内的申根签证或美国签证（B类等），可免签进入哥伦比亚停留最长90天。否则需提前申请哥伦比亚签证。",
    transitInfo: "波哥大机场（BOG）自中转，需符合免签政策（持美/申根签）或有哥伦比亚签证才能出海关拿行李。",
  },
  LIM: {
    country: "秘鲁",
    visaInfo: "🇵🇪 持中国普通护照且持有有效期在6个月以上的美国、加拿大、英国、澳大利亚或申根国有效签证或永居证，可免签进入秘鲁停留最长180天。否则需申请秘鲁签证。",
    transitInfo: "利马机场（LIM）自中转，须符合上述免签条件或持有秘鲁签证才能入境重新托运行李。",
  },
  MEX: {
    country: "墨西哥",
    visaInfo: "🇲🇽 持中国普通护照且持有有效的美国签证、加拿大签证、英国签证、日本签证、申根签证或上述国家的永久居留证，可免签入境墨西哥（停留最长180天）。否则**绝对必须**提前办理墨西哥正规签证，没有过境免签区！",
    transitInfo: "墨西哥城机场（MEX）没有设立纯国际转机免签区。所有旅客（即使直接转机不提取行李）**都必须持有上述国家的有效签证（或墨西哥正规签证）出海关安检**。若属于自中转，更必须符合免签条件或持有墨西哥签证才能出海关提行李。",
  },
  CUN: { country: "墨西哥", visaInfo: "🇲🇽 转机或入境须持有美国、加拿大、英国、日本或申根有效签证，或墨西哥签证。", transitInfo: "坎昆机场同理，无上述签证者无法过境或自中转办理重新托运。" },
};

// 申根国家列表
const SCHENGEN_CODES = [
  "CDG", "FRA", "MUC", "AMS", "FCO", "MAD", "BCN", "ZRH", "VIE", "HEL", "CPH", "ARN", "OSL", "ATH", "LIS", "PRG", "WAW", "BUD"
];

// 中国大陆机场列表前缀/代码
const CHINA_MAINLAND_CODES = [
  "PVG", "SHA", "PEK", "PKX", "CAN", "SZX", "CTU", "TFU", "CKG", "HGH", "NKG", "WUH", "XIY", "KMG", "CSX", "XMN", "TAO", "DLC", "TSN", "SYX", "HAK", "FOC", "NNG", "HRB", "SHE", "CGO", "URC", "LHW", "TNA"
];

function getAirportCountryInfo(code: string) {
  const c = code.toUpperCase();
  if (CHINA_MAINLAND_CODES.includes(c)) {
    return {
      country: "中国大陆",
      visaInfo: "🇨🇳 无需签证（正返回中国大陆境内或国内航线）。",
      transitInfo: "中国大陆境内转机。如果是国内航班直接换乘；如果涉及国际段自中转，中国公民在自家国境可凭身份证/护照自由出入海关重新托运行李。"
    };
  }
  
  if (SCHENGEN_CODES.includes(c)) {
    return {
      country: "欧洲申根区国家",
      visaInfo: "🇪🇺 目的地属于欧洲申根成员国，持中国普通护照需要提前申请并获得有效的申根签证。如果仅仅是在申根国单机场同区域直接转机（不出国际候机区，单一申根国转机且去往非申根国家），通常无需机场过境签证（ATV）；但若自中转需要出海关提行李，**必须**办妥申根旅游签证。",
      transitInfo: "欧洲申根机场转机。联程不入境直接换乘；**如果包含两个以上申根机场 of the 转机（相当于已进入申根国境内航班），或者属于分开出票的自中转（需出关提取行李重新托运），您必须持有有效的申根签证才能进行！**"
    };
  }

  return AIRPORT_COUNTRIES[c] || {
    country: "海外其他国家/地区",
    visaInfo: "📝 持中国普通护照出境前往该国/地区，通常需要提前办妥入境签证或申请电子签。请在购票后通过目的地国家驻华使领馆或官方渠道核实最新的签证与过境规定。",
    transitInfo: "在海外机场转机。联程不出转机区域通常不需要过境签证。如果是自中转需要入境提行李，**请务必确认是否需要办理该国入境签证或过境签证**。"
  };
}

export function getFaqAndRemarks(
  origin: string,
  dest: string,
  layoverCities: string[],
  freeCheckedBag: boolean,
  bagRecheck: boolean,
  departTimeStr: string | null,
  arriveTimeStr: string | null
): FaqItem[] {
  const faqs: FaqItem[] = [];

  const destAirport = getAirport(dest);
  const destName = destAirport ? `${destAirport.city}（${destAirport.name}）` : dest;
  const destCountryInfo = getAirportCountryInfo(dest);

  // 1. 行李直挂 FAQ
  faqs.push({
    q: "中转时我需要重新提取并托运行李吗？",
    a: bagRecheck
      ? `⚠️ **需要重新托运（自中转/非联程机票）**。由于该航线包含**自中转（分开出票）**航段，行李无法直挂终点。您在转机地机场**必须先办理入境海关手续**，前往行李转盘提取行李，然后携带行李前往出发大厅，重新在下一航段承运航司的柜台办理值机及托运。请确保中转停留时间充足（建议至少保留 3-4 小时），并确保持有转机地的有效入境或过境签证。`
      : `✅ **行李直挂终点（联程机票）**。本航班为标准联程机票，正常情况下，您的托运行李在出发地机场办理值机后，将由航空公司直接直挂运送至目的地 ${destName}，中转时无需提取行李。建议在起飞当天值机时，向航司柜台工作人员再次核实确认行李牌的目的地代码是否正确。`,
    type: "baggage",
    warning: bagRecheck,
  });

  // 2. 行李额度 FAQ
  faqs.push({
    q: "本机票包含免费托运行李额度吗？",
    a: freeCheckedBag
      ? `✅ **包含免费托运额度**。该机票中已包含免费托运行李服务。不同航空公司及舱位类型对应的免费托运限额（例如 1件 23kg 或 20kg 限重）有所不同，建议在购票后登录航司官网或在预订详情中核实具体行李限额规定。`
      : `⚠️ **不含免费托运额度（廉价航空）**。由于该航线的全部或部分航段由低成本航空（LCC，例如酷航等）承运，此等机票默认**不含免费托运行李额**，仅包含随身携带的手提行李额度（一般为 7kg-10kg）。如需托运行李，**请务必在购票时或起飞前通过航司官网/APP加购行李额度**，机场柜台现场加购的费用极其昂贵。`,
    type: "baggage",
    warning: !freeCheckedBag,
  });

  // 3. 目的地签证 FAQ
  faqs.push({
    q: `持中国普通护照前往 ${destAirport?.city || dest} 需要办理签证吗？`,
    a: destCountryInfo.visaInfo,
    type: "visa",
    warning: !CHINA_MAINLAND_CODES.includes(dest.toUpperCase()) && !["SIN", "HKG", "MFM", "BKK", "DMK", "CNX", "HKT", "KUL", "PEN", "DXB", "AUH", "DOH", "CMB"].includes(dest.toUpperCase()) && !SCHENGEN_CODES.includes(dest.toUpperCase()),
  });

  // 4. 中转签证 FAQ (如果有中转)
  if (layoverCities && layoverCities.length > 0) {
    const transitDetails = layoverCities.map((code) => {
      const apt = getAirport(code);
      const name = apt ? `${apt.city}(${code})` : code;
      const info = getAirportCountryInfo(code);
      return `- **在 ${name} 转机**：${info.transitInfo}`;
    }).join("\n\n");

    let transitAnswer = `您将经由 **${layoverCities.join(" → ")}** 转机。以下是转机地的签证要求建议：\n\n${transitDetails}`;
    
    if (bagRecheck) {
      transitAnswer += `\n\n⚠️ **特别警示**：由于本次行程包含**自中转（行李非直挂）**，您在中转站**绝对必须办理入境通关手续才能提取行李**。这意味着您在转机国/地区不仅是“国际转机”，而且是**实质入境行为**。您**必须确保自己持有每一个转机国/地区的入境签证或过境签**，否则您将无法出海关提取行李以办理下一程登机，甚或直接在出发机场被拒绝登机！`;
    }

    faqs.push({
      q: `经 ${layoverCities.join("/")} 转机，中国护照需要办理过境签证吗？`,
      a: transitAnswer,
      type: "visa",
      warning: bagRecheck || layoverCities.some(code => ["JFK", "EWR", "LAX", "SFO", "ORD", "ATL", "DFW", "SEA", "IAD", "MIA", "BOS", "SYD", "MEL", "BNE", "AKL"].includes(code.toUpperCase())),
    });
  }

  return faqs;
}

/**
 * 辅助函数：根据 ISO 时间字符串计算并格式化两个日期时间的间隔时长 (小时 + 分钟)
 */
export function formatDuration(departStr: string | null, arriveStr: string | null): string {
  if (!departStr || !arriveStr) return "—";
  try {
    const dep = new Date(departStr);
    const arr = new Date(arriveStr);
    const diffMs = arr.getTime() - dep.getTime();
    if (diffMs <= 0) return "—";
    
    const diffMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    
    if (hours === 0) {
      return `${mins}分钟`;
    }
    return `${hours}小时${mins}分钟`;
  } catch (e) {
    return "—";
  }
}

/**
 * 辅助函数：格式化具体的日期时间为简洁展示格式，例如 `2026-08-15 14:30`
 */
export function formatDateTime(isoStr: string | null): string {
  if (!isoStr) return "—";
  try {
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return isoStr;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d} ${hh}:${mm}`;
  } catch (e) {
    return isoStr;
  }
}

// 简单的时分格式化
export function formatTimeOnly(isoStr: string | null): string {
  if (!isoStr) return "—";
  try {
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return "—";
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    if (hh === "00" && mm === "00") return "整天";
    return `${hh}:${mm}`;
  } catch (e) {
    return "—";
  }
}
