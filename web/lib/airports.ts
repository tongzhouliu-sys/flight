// ─────────────────────────────────────────────────────────────────────────
// 机场数据字典 + 检索工具函数
// 覆盖东亚 / 东南亚主要机场 + 全球热门枢纽，可按需追加。
// ─────────────────────────────────────────────────────────────────────────

export interface AirportInfo {
  /** IATA 三字码 */
  code: string;
  /** 机场名称（中文） */
  name: string;
  /** 所在城市（中文） */
  city: string;
  /** 所在城市（英文，辅助搜索） */
  cityEn: string;
}

const AIRPORTS: AirportInfo[] = [
  // ── 新加坡 ──
  { code: "SIN", name: "樟宜国际机场", city: "新加坡", cityEn: "Singapore" },

  // ── 中国大陆 ──
  { code: "PVG", name: "浦东国际机场", city: "上海", cityEn: "Shanghai" },
  { code: "SHA", name: "虹桥国际机场", city: "上海", cityEn: "Shanghai" },
  { code: "PEK", name: "首都国际机场", city: "北京", cityEn: "Beijing" },
  { code: "PKX", name: "大兴国际机场", city: "北京", cityEn: "Beijing" },
  { code: "CAN", name: "白云国际机场", city: "广州", cityEn: "Guangzhou" },
  { code: "SZX", name: "宝安国际机场", city: "深圳", cityEn: "Shenzhen" },
  { code: "CTU", name: "天府国际机场", city: "成都", cityEn: "Chengdu" },
  { code: "TFU", name: "双流国际机场", city: "成都", cityEn: "Chengdu" },
  { code: "CKG", name: "江北国际机场", city: "重庆", cityEn: "Chongqing" },
  { code: "HGH", name: "萧山国际机场", city: "杭州", cityEn: "Hangzhou" },
  { code: "NKG", name: "禄口国际机场", city: "南京", cityEn: "Nanjing" },
  { code: "WUH", name: "天河国际机场", city: "武汉", cityEn: "Wuhan" },
  { code: "XIY", name: "咸阳国际机场", city: "西安", cityEn: "Xi'an" },
  { code: "KMG", name: "长水国际机场", city: "昆明", cityEn: "Kunming" },
  { code: "CSX", name: "黄花国际机场", city: "长沙", cityEn: "Changsha" },
  { code: "XMN", name: "高崎国际机场", city: "厦门", cityEn: "Xiamen" },
  { code: "TAO", name: "胶东国际机场", city: "青岛", cityEn: "Qingdao" },
  { code: "DLC", name: "周水子国际机场", city: "大连", cityEn: "Dalian" },
  { code: "TSN", name: "滨海国际机场", city: "天津", cityEn: "Tianjin" },
  { code: "SYX", name: "凤凰国际机场", city: "三亚", cityEn: "Sanya" },
  { code: "HAK", name: "美兰国际机场", city: "海口", cityEn: "Haikou" },
  { code: "FOC", name: "长乐国际机场", city: "福州", cityEn: "Fuzhou" },
  { code: "NNG", name: "吴圩国际机场", city: "南宁", cityEn: "Nanning" },
  { code: "HRB", name: "太平国际机场", city: "哈尔滨", cityEn: "Harbin" },
  { code: "SHE", name: "桃仙国际机场", city: "沈阳", cityEn: "Shenyang" },
  { code: "CGO", name: "新郑国际机场", city: "郑州", cityEn: "Zhengzhou" },
  { code: "URC", name: "地窝堡国际机场", city: "乌鲁木齐", cityEn: "Urumqi" },
  { code: "LHW", name: "中川国际机场", city: "兰州", cityEn: "Lanzhou" },
  { code: "TNA", name: "遥墙国际机场", city: "济南", cityEn: "Jinan" },

  // ── 香港 / 澳门 / 台湾 ──
  { code: "HKG", name: "香港国际机场", city: "香港", cityEn: "Hong Kong" },
  { code: "MFM", name: "澳门国际机场", city: "澳门", cityEn: "Macau" },
  { code: "TPE", name: "桃园国际机场", city: "台北", cityEn: "Taipei" },
  { code: "TSA", name: "松山机场", city: "台北", cityEn: "Taipei" },
  { code: "KHH", name: "高雄国际机场", city: "高雄", cityEn: "Kaohsiung" },

  // ── 日本 ──
  { code: "NRT", name: "成田国际机场", city: "东京", cityEn: "Tokyo" },
  { code: "HND", name: "羽田机场", city: "东京", cityEn: "Tokyo" },
  { code: "KIX", name: "关西国际机场", city: "大阪", cityEn: "Osaka" },
  { code: "ITM", name: "伊丹机场", city: "大阪", cityEn: "Osaka" },
  { code: "NGO", name: "中部国际机场", city: "名古屋", cityEn: "Nagoya" },
  { code: "FUK", name: "福冈机场", city: "福冈", cityEn: "Fukuoka" },
  { code: "CTS", name: "新千岁机场", city: "札幌", cityEn: "Sapporo" },
  { code: "OKA", name: "那霸机场", city: "冲绳", cityEn: "Okinawa" },

  // ── 韩国 ──
  { code: "ICN", name: "仁川国际机场", city: "首尔", cityEn: "Seoul" },
  { code: "GMP", name: "金浦国际机场", city: "首尔", cityEn: "Seoul" },
  { code: "PUS", name: "金海国际机场", city: "釜山", cityEn: "Busan" },
  { code: "CJU", name: "济州国际机场", city: "济州", cityEn: "Jeju" },

  // ── 东南亚 ──
  { code: "BKK", name: "素万那普国际机场", city: "曼谷", cityEn: "Bangkok" },
  { code: "DMK", name: "廊曼国际机场", city: "曼谷", cityEn: "Bangkok" },
  { code: "CNX", name: "清迈国际机场", city: "清迈", cityEn: "Chiang Mai" },
  { code: "HKT", name: "普吉国际机场", city: "普吉", cityEn: "Phuket" },
  { code: "KUL", name: "吉隆坡国际机场", city: "吉隆坡", cityEn: "Kuala Lumpur" },
  { code: "PEN", name: "槟城国际机场", city: "槟城", cityEn: "Penang" },
  { code: "MNL", name: "尼诺阿基诺国际机场", city: "马尼拉", cityEn: "Manila" },
  { code: "CEB", name: "麦克坦国际机场", city: "宿务", cityEn: "Cebu" },
  { code: "SGN", name: "新山一国际机场", city: "胡志明市", cityEn: "Ho Chi Minh City" },
  { code: "HAN", name: "内排国际机场", city: "河内", cityEn: "Hanoi" },
  { code: "DAD", name: "岘港国际机场", city: "岘港", cityEn: "Da Nang" },
  { code: "CGK", name: "苏加诺-哈达国际机场", city: "雅加达", cityEn: "Jakarta" },
  { code: "DPS", name: "伍拉·赖国际机场", city: "巴厘岛", cityEn: "Bali" },
  { code: "RGN", name: "仰光国际机场", city: "仰光", cityEn: "Yangon" },
  { code: "PNH", name: "金边国际机场", city: "金边", cityEn: "Phnom Penh" },
  { code: "REP", name: "暹粒国际机场", city: "暹粒", cityEn: "Siem Reap" },
  { code: "VTE", name: "瓦岱国际机场", city: "万象", cityEn: "Vientiane" },
  { code: "BWN", name: "文莱国际机场", city: "斯里巴加湾", cityEn: "Bandar Seri Begawan" },

  // ── 南亚 ──
  { code: "DEL", name: "英迪拉·甘地国际机场", city: "新德里", cityEn: "New Delhi" },
  { code: "BOM", name: "贾特拉帕蒂·希瓦吉国际机场", city: "孟买", cityEn: "Mumbai" },
  { code: "BLR", name: "肯佩高达国际机场", city: "班加罗尔", cityEn: "Bangalore" },
  { code: "MAA", name: "金奈国际机场", city: "金奈", cityEn: "Chennai" },
  { code: "CCU", name: "内塔吉·苏巴斯·钱德拉·鲍斯国际机场", city: "加尔各答", cityEn: "Kolkata" },
  { code: "CMB", name: "班达拉奈克国际机场", city: "科伦坡", cityEn: "Colombo" },
  { code: "DAC", name: "沙阿贾拉勒国际机场", city: "达卡", cityEn: "Dhaka" },

  // ── 中东 ──
  { code: "DXB", name: "迪拜国际机场", city: "迪拜", cityEn: "Dubai" },
  { code: "DOH", name: "哈马德国际机场", city: "多哈", cityEn: "Doha" },
  { code: "AUH", name: "阿布扎比国际机场", city: "阿布扎比", cityEn: "Abu Dhabi" },
  { code: "IST", name: "伊斯坦布尔机场", city: "伊斯坦布尔", cityEn: "Istanbul" },
  { code: "TLV", name: "本-古里安国际机场", city: "特拉维夫", cityEn: "Tel Aviv" },

  // ── 欧洲 ──
  { code: "LHR", name: "希思罗机场", city: "伦敦", cityEn: "London" },
  { code: "LGW", name: "盖特威克机场", city: "伦敦", cityEn: "London" },
  { code: "CDG", name: "戴高乐机场", city: "巴黎", cityEn: "Paris" },
  { code: "FRA", name: "法兰克福机场", city: "法兰克福", cityEn: "Frankfurt" },
  { code: "MUC", name: "慕尼黑机场", city: "慕尼黑", cityEn: "Munich" },
  { code: "AMS", name: "史基浦机场", city: "阿姆斯特丹", cityEn: "Amsterdam" },
  { code: "FCO", name: "菲乌米奇诺机场", city: "罗马", cityEn: "Rome" },
  { code: "MAD", name: "巴拉哈斯机场", city: "马德里", cityEn: "Madrid" },
  { code: "BCN", name: "埃尔普拉特机场", city: "巴塞罗那", cityEn: "Barcelona" },
  { code: "ZRH", name: "苏黎世机场", city: "苏黎世", cityEn: "Zurich" },
  { code: "VIE", name: "维也纳机场", city: "维也纳", cityEn: "Vienna" },
  { code: "HEL", name: "万塔机场", city: "赫尔辛基", cityEn: "Helsinki" },
  { code: "CPH", name: "凯斯楚普机场", city: "哥本哈根", cityEn: "Copenhagen" },
  { code: "ARN", name: "阿兰达机场", city: "斯德哥尔摩", cityEn: "Stockholm" },
  { code: "OSL", name: "加勒穆恩机场", city: "奥斯陆", cityEn: "Oslo" },
  { code: "ATH", name: "埃莱夫塞里奥斯·韦尼泽洛斯机场", city: "雅典", cityEn: "Athens" },
  { code: "LIS", name: "温贝托·德尔加多机场", city: "里斯本", cityEn: "Lisbon" },
  { code: "DUB", name: "都柏林机场", city: "都柏林", cityEn: "Dublin" },
  { code: "PRG", name: "瓦茨拉夫·哈维尔机场", city: "布拉格", cityEn: "Prague" },
  { code: "WAW", name: "肖邦机场", city: "华沙", cityEn: "Warsaw" },
  { code: "BUD", name: "李斯特·费伦茨机场", city: "布达佩斯", cityEn: "Budapest" },

  // ── 北美 ──
  { code: "JFK", name: "肯尼迪国际机场", city: "纽约", cityEn: "New York" },
  { code: "EWR", name: "纽瓦克自由国际机场", city: "纽约", cityEn: "New York" },
  { code: "LAX", name: "洛杉矶国际机场", city: "洛杉矶", cityEn: "Los Angeles" },
  { code: "SFO", name: "旧金山国际机场", city: "旧金山", cityEn: "San Francisco" },
  { code: "ORD", name: "奥黑尔国际机场", city: "芝加哥", cityEn: "Chicago" },
  { code: "ATL", name: "哈茨菲尔德-杰克逊国际机场", city: "亚特兰大", cityEn: "Atlanta" },
  { code: "DFW", name: "达拉斯-沃斯堡国际机场", city: "达拉斯", cityEn: "Dallas" },
  { code: "SEA", name: "西雅图-塔科马国际机场", city: "西雅图", cityEn: "Seattle" },
  { code: "IAD", name: "杜勒斯国际机场", city: "华盛顿", cityEn: "Washington" },
  { code: "MIA", name: "迈阿密国际机场", city: "迈阿密", cityEn: "Miami" },
  { code: "BOS", name: "洛根国际机场", city: "波士顿", cityEn: "Boston" },
  { code: "YVR", name: "温哥华国际机场", city: "温哥华", cityEn: "Vancouver" },
  { code: "YYZ", name: "皮尔逊国际机场", city: "多伦多", cityEn: "Toronto" },

  // ── 大洋洲 ──
  { code: "SYD", name: "金斯福德·史密斯国际机场", city: "悉尼", cityEn: "Sydney" },
  { code: "MEL", name: "墨尔本机场", city: "墨尔本", cityEn: "Melbourne" },
  { code: "BNE", name: "布里斯班机场", city: "布里斯班", cityEn: "Brisbane" },
  { code: "AKL", name: "奥克兰机场", city: "奥克兰", cityEn: "Auckland" },

  // ── 非洲 ──
  { code: "JNB", name: "奥利弗·坦博国际机场", city: "约翰内斯堡", cityEn: "Johannesburg" },
  { code: "CAI", name: "开罗国际机场", city: "开罗", cityEn: "Cairo" },
  { code: "ADD", name: "博莱国际机场", city: "亚的斯亚贝巴", cityEn: "Addis Ababa" },
  { code: "NBO", name: "乔莫·肯雅塔国际机场", city: "内罗毕", cityEn: "Nairobi" },

  // ── 南美 ──
  { code: "GRU", name: "瓜鲁柳斯国际机场", city: "圣保罗", cityEn: "São Paulo" },
  { code: "EZE", name: "埃塞萨国际机场", city: "布宜诺斯艾利斯", cityEn: "Buenos Aires" },
  { code: "SCL", name: "阿图罗·梅里诺·贝尼特斯国际机场", city: "圣地亚哥", cityEn: "Santiago" },
  { code: "BOG", name: "埃尔多拉多国际机场", city: "波哥大", cityEn: "Bogota" },
  { code: "LIM", name: "豪尔赫·查韦斯国际机场", city: "利马", cityEn: "Lima" },
  { code: "MEX", name: "贝尼托·华雷斯国际机场", city: "墨西哥城", cityEn: "Mexico City" },
  { code: "CUN", name: "坎昆国际机场", city: "坎昆", cityEn: "Cancun" },
];

// ── 索引 ──

const byCode = new Map<string, AirportInfo>();
for (const a of AIRPORTS) byCode.set(a.code, a);

// ── 公共 API ──

/** 根据 IATA 代码查机场信息，未收录返回 undefined */
export function getAirport(code: string): AirportInfo | undefined {
  return byCode.get(code.toUpperCase());
}

/** 格式化为展示字符串，如 `SIN 樟宜国际机场（新加坡）`；未收录则原样返回代码 */
export function formatAirport(code: string): string {
  const a = getAirport(code);
  if (!a) return code;
  return `${a.code} ${a.name}（${a.city}）`;
}

/** 返回简短城市标签，如 `新加坡`；未收录返回空字符串 */
export function airportCity(code: string): string {
  return getAirport(code)?.city ?? "";
}

/** 模糊搜索：匹配 IATA 代码、中文机场名、中文城市名、英文城市名。最多返回 8 条。 */
export function searchAirports(query: string): AirportInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  // 精确匹配 IATA 代码优先
  const exact = byCode.get(q.toUpperCase());
  if (exact) {
    return [
      exact,
      ...AIRPORTS.filter(
        (a) =>
          a.code !== exact.code &&
          (a.city === exact.city ||
            a.cityEn.toLowerCase() === exact.cityEn.toLowerCase()),
      ),
    ].slice(0, 8);
  }

  return AIRPORTS.filter(
    (a) =>
      a.code.toLowerCase().includes(q) ||
      a.name.includes(q) ||
      a.city.includes(q) ||
      a.cityEn.toLowerCase().includes(q),
  ).slice(0, 8);
}
