# FareRadar 机票雷达 · 产品需求文档（PRD）

| 项 | 内容 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-07-06 |
| 状态 | 待评审 |
| 产品负责人 / 唯一用户 | TONGZHOU |
| 上游文档 | 《FareRadar-提示词评估与产品方案-v1.0》 |
| 下游文档 | 技术开发文档（数据库 DDL、API 契约、部署清单，待产出） |

---

## 1. 背景与问题定义

现状：每年在 SIN / WUH / HKG / LAX 四城之间多次往返，购票依赖临时人工搜索。人工搜索无法回答两个决定性问题：

1. 当前报价在该航线的历史价格分布中处于什么水平（现在买是贵还是便宜）。
2. 在可接受的约束（时间弹性、行李、证件、衔接风险）内，是否存在更便宜的等效行程。

问题本质：缺少固定航线的价格历史积累与持续监控，购票时机与方案选择均为盲决策。

机会窗口：航线集合固定且小（8 个监控项）；价格数据可经免费开源库获取（fli / fast-flights，2026-07 查证可用）；调度、存储、通知的基础设施（GitHub Actions、Railway FastAPI + PostgreSQL、Cloudflare Worker、飞书 Bot）已在既有项目中运行，边际建设成本低。

## 2. 产品目标与成功指标

产品目标（一句话）：让常飞航线上的每次实际购票价格落在该航线历史分布的 P25 以下。

North Star 指标：年度实际节省金额 = Σ（购票时该航线基线 P50 − 实际成交价），经 `/bought` 指令登记后自动累计。

| 指标 | 目标值 | 度量方式 |
|---|---|---|
| 年度实际节省 | ≥ S$1,500 | North Star，`/bought` 登记累计 |
| 经系统完成的实际预订 | ≥ 4 次 / 年 | 同上 |
| 采价存活率（30 天滚动） | ≥ 95% | 采价日志统计（FR-OPS-01） |
| 告警有效率 | 推送后 24h 内该价仍可订 ≥ 70% | 抽样人工复核 |
| 数据成本 | 常态 $0 / 月，上限 $25 / 月 | 账单 |

护栏指标（反向约束）：周告警 ≤ 5 条；冷启动期（前 4 周）之外的误报率 ≤ 30%。任一护栏连续两周失守时，优先修阈值而非加功能。

## 3. 用户与使用场景

单用户系统，用户 = 运营者 = 产品负责人。不设账号体系。

| 编号 | 用户故事 | 对应能力 |
|---|---|---|
| US-1 | 我不主动查价；任一监控航线出现历史低位价格时，我在飞书收到一张含"是否值得买"判断依据的信号卡 | L1 雷达（FR-SIG-01） |
| US-2 | 我已确定"8 月下旬去武汉，前后可挪 3 天"，登记该意向后系统在窗口内持续盯价，在合适时点提醒 | TripIntent + 日期平移（FR-SIG-02） |
| US-3 | 我想知道"下个月去 LA 大概什么价、哪天最便宜"，发一条飞书指令获得价格日历摘要 | `/fare` 指令（FR-NTF-03） |
| US-4 | 购票后我登记实际成交价，系统累计年度节省指标 | `/bought` 指令（FR-NTF-03） |
| US-5 | 系统采价异常或数据源降级时，我收到运维通知而不是默默漏数据 | FR-NTF-05 |

## 4. 范围定义

### 4.1 In Scope（v1.0）

- 8 个监控航线项的两级采价（日历扫 + 详情钻取）与快照存储
- 分位数基线（含 SerpAPI price_insights 冷启动）
- L1 基线击穿告警；L2 三规则：日期平移、邻近机场、分开出票
- 飞书信号卡、指令集、周报、运维通知
- 风险硬约束过滤与风险标签、LCC 折算总价

### 4.2 Out of Scope（v1.0 明确不做）

| 项 | 说明 |
|---|---|
| 预订与支付 | 纯发现 + 深链跳转，出票留给官网 / OTA |
| 机器学习价格预测 | 分位数阈值 + Google price_insights 已够用 |
| 全网 OTA 比价 | 单主源（Google Flights 聚合）+ 校验源 |
| 多用户 / SaaS 化 | 约束硬编码于配置文件为合理设计 |
| 弃程（hidden city）、出票地/货币套利、开口程 | 规则插槽保留，默认禁用（FR-SIG-06） |
| 中国国内段采价 | 数据源维护成本过高，需要时人工核价 |
| 里程票 / 积分票水位 | 仅现金票 |
| 购后降价重订监控 | 列入 V2 候选 |

V2 候选清单（不承诺）：购后降价重订、弃程规则、出票地套利、里程票水位、商务舱基线。

## 5. 全局配置与默认假设（v1.0 固化值）

以下配置将此前方案中的 5 项待确认输入固化为 v1.0 默认值。判断前提随值列出；除 `trip_type` 外均为配置级改动，`trip_type` 涉及的表结构（`return_date` 可空）已在数据模型中预留，实际也不构成结构性锁定。

### 5.1 config.yaml 初始值

| 配置键 | v1.0 取值 | 判断前提 | 修改影响 |
|---|---|---|---|
| `cabin` | economy | 商务舱基线样本少、波动逻辑不同，v1.0 不混入 | 改后需重建基线 |
| `pax` | 1 adult | 多人票可能落入不同库存舱位；监控按单人，购票时人工复核多人价 | 无结构影响 |
| `lead_buckets` | 0–13 / 14–56 / 57+ 天 | 典型购票提前期未确认，取 14–56 为主桶 | 重算基线 |
| `scan_horizon_days` | 60 | 覆盖主桶 + 观察带 | 查询量线性变化 |
| `alert_threshold` | P15（样本 n ≥ 30 时）；冷启动期用 price_insights 区间下界 × 0.95 | — | 即时生效 |
| `weekly_alert_cap` | 5 | 防告警疲劳 | 即时生效 |
| `dedup_ttl_hours` | 72 | — | 即时生效 |
| `nearby_adder_sgd` | 40（HKG↔SZX/CAN 口岸折算加价） | 前提：持有效通行证件、可接受陆路口岸；时间差仅展示不折价 | 即时生效 |
| `selftransfer.min_connect_min` | 240（国际转国际） | 两票自担衔接风险的底线 | 即时生效 |
| `selftransfer.hubs` | TPE, NRT, ICN, HKG | 控制组合爆炸 | 查询量变化 |
| `serpapi_monthly_cap` | 200 次 | 免费额度 250 内留余量 | 即时生效 |

### 5.2 routes.yaml 初始值

| ID | 航线 | trip_type | 停留窗口 | tier | enabled |
|---|---|---|---|---|---|
| R1 | SIN → WUH | one_way | — | P0 | true |
| R2 | WUH → SIN | one_way | — | P0 | true |
| R3 | SIN → HKG | one_way | — | P0 | true |
| R4 | HKG → SIN | one_way | — | P0 | true |
| R5 | SIN ⇄ LAX | round_trip | 7–14 天（日历扫代表值 10 天） | P1 | true |
| R6 | WUH → HKG | one_way | — | P1 | true |
| R7 | HKG → WUH | one_way | — | P1 | true |
| R8 | WUH ⇄ LAX | round_trip | 7–14 天（代表值 10 天） | P2 | true |

trip_type 判断前提：短程航线 LCC 单程独立定价，单向监控最敏感；长程跨太平洋全服务往返价显著优于两张单程，按往返监控。

## 6. 功能需求

编号规则 `FR-<模块>-<序号>`；优先级 P0 = MVP 必须，P1 = MVP+，P2 = 观察。每条含验收标准。

### 6.1 采价模块（ING）

| 编号 | 优先级 | 需求 | 验收标准 |
|---|---|---|---|
| FR-ING-01 | P0 | 日历扫：每日 2 次（08:00 / 20:00 SGT，即 UTC 00:00 / 12:00 cron）对全部 enabled 航线执行日期区间最低价扫描，覆盖未来 `scan_horizon_days` 天；round_trip 航线以停留代表值扫描 | 单次全量扫描 ≤ 10 分钟；产出 ≥ 8 × 60 个日历价格点入库 |
| FR-ING-02 | P0 | 详情钻取：对日历价 < 该航线 P25 的（航线, 日期）发起航班级查询，采集承运人、中转数、起降时刻；round_trip 命中时在停留窗口内展开 | 钻取触发逻辑可在日志中逐条回溯 |
| FR-ING-03 | P0 | Provider Adapter 与降级链：fli → fast-flights → SerpAPI；单源连续失败 3 次自动切换下一级并推运维通知 | 人为断源测试可触发降级，当日采价不中断 |
| FR-ING-04 | P0 | 查询预算：每源每日预算计数（fli 100 / fast-flights 100 / SerpAPI 10，SerpAPI 月上限 `serpapi_monthly_cap`）；超限停止该源当日采集并告警 | 预算余量可查（FR-OPS-02）；超限行为可测 |
| FR-ING-05 | P1 | 基线校准：每航线每周 ≤ 2 次拉取 SerpAPI price_insights（typical_price_range、price_history）写入冷启动基线 | 校准数据与自建基线在库中可区分 |
| FR-ING-06 | P2 | Amadeus 校验：对已触发告警的报价，可选调用 Flight Offers Search 校验税费与行李额（免费月配额内） | 校验结果附加到信号卡 |

### 6.2 存储与基线（BAS）

| 编号 | 优先级 | 需求 | 验收标准 |
|---|---|---|---|
| FR-BAS-01 | P0 | 快照入库：日历粗粒度与详情细粒度共用 PriceSnapshot 表，`is_calendar` 区分（字段见 §8） | 字段完整率 100%，无缺 provider / captured_at 的行 |
| FR-BAS-02 | P0 | 基线计算：每夜重算（route, travel_month, lead_bucket）的 P10 / P25 / P50；样本 n < 30 标记 low_confidence 并回退冷启动值 | 基线表每日更新时间戳；low_confidence 状态正确传递到信号卡 |
| FR-BAS-03 | P1 | 数据保留：日历快照保留 400 天（覆盖同比），详情快照保留 180 天，超期归档删除 | 定时清理任务日志可查 |

### 6.3 信号引擎（SIG）

| 编号 | 优先级 | 需求 | 验收标准 |
|---|---|---|---|
| FR-SIG-01 | P0 | BaselineBreach：日历价 < 基线 P15（或冷启动阈值）→ 生成 Opportunity(type=baseline_breach) | 阈值参数化；触发计算过程写入 evidence |
| FR-SIG-02 | P1 | DateShiftRule：对已登记 TripIntent，弹性窗口内最低价相对中心日期价节省 ≥ max(15%, S$50) → Opportunity(type=date_shift) | 窗口边界含端点；节省额计算可回溯 |
| FR-SIG-03 | P1 | NearbyAirportRule：HKG 航线与 SZX / CAN 等效航线比较，折算价差（含 `nearby_adder_sgd`）≥ max(12%, S$60) → Opportunity(type=nearby_airport) | 卡片展示折算前后两价与时间差 |
| FR-SIG-04 | P1 | SelfTransferRule：仅 round_trip 航线；经 `selftransfer.hubs` 白名单枢纽两票拼接，衔接 ≥ `min_connect_min`，折算节省（扣除 S$50 保险预算）≥ max(12%, S$150) → Opportunity(type=self_transfer)；因查询成本每周执行 1 次 | 不满足最小衔接的组合不产出；两票属性在卡片显著标注 |
| FR-SIG-05 | P0 | 证据链：每个 Opportunity 必须引用 ≥ 1 个真实 snapshot_id，无证据不产出 | 随机抽卡可反查到快照原始行 |
| FR-SIG-06 | P2 | 规则插槽：HiddenCity / CurrencyArbitrage / OpenJaw 实现统一 Rule 接口，配置默认 disabled | 接口存在、启用开关存在、默认关闭 |

### 6.4 风险过滤（RSK）

| 编号 | 优先级 | 需求 | 验收标准 |
|---|---|---|---|
| FR-RSK-01 | P0 | 硬约束过滤（命中即丢弃）：self_transfer 衔接 < 下限；邻近机场方案证件配置不满足；round_trip 航线上的单段弃程类方案（插槽启用时） | 被过滤项写入日志含原因码 |
| FR-RSK-02 | P0 | 风险标签枚举：two_ticket / border_crossing / lcc_baggage / overnight_layover / short_layover / low_confidence_baseline；信号卡必须展示全部命中标签 | 标签集中定义，卡片渲染齐全 |
| FR-RSK-03 | P0 | 折算总价：LCC 报价必须叠加托运行李费后参与比较与展示；行李费按承运人配置表取值 | 无折算总价的 LCC 卡片不发送 |

### 6.5 通知与交互（NTF）

| 编号 | 优先级 | 需求 | 验收标准 |
|---|---|---|---|
| FR-NTF-01 | P0 | 信号卡推送：规格见 §9.1；缺"基线位置"或"折算总价"任一字段的卡片不发送 | 字段校验拦截可测 |
| FR-NTF-02 | P0 | 去重与限流：dedup_key = route + depart_date(+return_date) + type + 价格档（S$10 取整），TTL 72h；周上限 `weekly_alert_cap`，超出时仅保留节省额最高者即时推送，其余归入周报 | 同键重复不推；第 6 条起进周报可测 |
| FR-NTF-03 | P1 | 指令集：`/fare` `/watch` `/bought` `/mute` `/status`，语法见 §9.2；正则解析，不接大模型 | 5 条指令端到端可用，响应 ≤ 5s |
| FR-NTF-04 | P1 | 周报：每周日 20:00 SGT 汇总各航线价格水位、被限流的次级机会、系统健康摘要 | 周报含上述三段 |
| FR-NTF-05 | P0 | 运维通知：数据源降级、预算超限、当日采价完全失败，实时推送 | 三类事件各可触发验证 |

### 6.6 可观测（OPS）

| 编号 | 优先级 | 需求 | 验收标准 |
|---|---|---|---|
| FR-OPS-01 | P0 | 采价成功率按日记录，30 天滚动统计可导出 | 报表含总请求、成功、降级、失败四列 |
| FR-OPS-02 | P1 | `/status` 返回：最近采价时间、30 天成功率、各源当日预算余量、低置信度基线数量 | 字段齐全 |

## 7. 非功能需求

| 编号 | 类别 | 要求 |
|---|---|---|
| NFR-01 | 成本 | 数据成本常态 $0 / 月，硬上限 $25 / 月；计算与存储复用现有 GitHub Actions 免费额度与 Railway 项目 |
| NFR-02 | 时效 | 非实时系统：价格新鲜度 ≤ 12h（每日 2 次采价）；接受错过存续 < 12h 的闪价，此为成本换来的明确取舍 |
| NFR-03 | 可靠性 | 30 天采价存活率 ≥ 95%；当日采价完全失败必须触发运维通知 |
| NFR-04 | 安全 | 全部 token / webhook 存 GitHub Secrets 与 Railway 环境变量；数据库不含任何第三方个人数据 |
| NFR-05 | 合规姿态 | 数据获取为个人低频使用（< 50 请求 / 日），数据不再分发、不商用；承认逆向接口的 ToS 灰色属性与随时失效风险，以降级链（FR-ING-03）兜底，不以对抗性手段（代理池、指纹伪造）维持 |
| NFR-06 | 可维护性 | 航线、阈值、枢纽白名单、行李费表全部配置文件化；改配置不改代码；配置变更记入 git 历史 |

## 8. 数据需求

实体与字段定义如下；索引设计与完整 DDL 归属技术开发文档。

| 实体 | 字段（类型） | 说明 |
|---|---|---|
| Route | id (text PK), origin (text), dest (text), trip_type (enum one_way/round_trip), stay_min/stay_max (int, nullable), tier (enum), nearby_airports (json), enabled (bool) | 与 routes.yaml 同步 |
| PriceSnapshot | id (bigserial PK), route_id (FK), depart_date (date), return_date (date, nullable), price (numeric), currency (text), carrier (text, nullable), stops (int, nullable), is_calendar (bool), provider (text), captured_at (timestamptz) | 日历点 carrier/stops 可空 |
| Baseline | route_id (FK), travel_month (text YYYY-MM), lead_bucket (enum), p10/p25/p50 (numeric), sample_n (int), low_confidence (bool), source (enum self/coldstart), updated_at | 复合主键 (route_id, travel_month, lead_bucket) |
| TripIntent | id, route_id, date_center (date), flex_days (int), pax (int), status (enum active/expired/done), created_at | `/watch` 写入 |
| Opportunity | id, type (enum), route_id, base_price, alt_price, saving, evidence_snapshot_ids (json), created_at | evidence 非空约束 |
| RiskCard | opportunity_id (FK), tags (json), hard_block (bool), block_reason (text, nullable) | — |
| Alert | id, opportunity_id (FK), dedup_key (text unique-in-TTL), channel (text), sent_at | — |
| Purchase | id, alert_id (FK, nullable), route_id, paid_price, baseline_p50_at_purchase, saving, purchased_at | `/bought` 写入，North Star 数据源 |

PriceSnapshot 行示例：

```json
{
  "route_id": "R1",
  "depart_date": "2026-08-21",
  "return_date": null,
  "price": 268.00,
  "currency": "SGD",
  "carrier": "TR",
  "stops": 0,
  "is_calendar": false,
  "provider": "fli",
  "captured_at": "2026-07-06T04:10:22+08:00"
}
```

## 9. 交互规格

### 9.1 飞书信号卡

必备字段（缺任一即拦截不发，FR-NTF-01）：

| 区块 | 字段 |
|---|---|
| 标题 | 信号类型 + 航线 |
| 行程 | 出发日期（+ 返回日期）、承运人、中转数 |
| 价格 | 当前价；LCC 加显折算总价（FR-RSK-03） |
| 基线位置 | 当前价分位、近 90 天中位、历史最低；low_confidence 时显著标注 |
| 触发 | 规则名 + 阈值 |
| 风险 | 全部命中标签（FR-RSK-02） |
| 建议 | 三档（立即买 / 关注 / 忽略）+ 星级 1–4，由分位数硬规则映射 |
| 操作 | Google Flights 深链、标记已购、静音该航线 7 天 |

卡片示例（示例数据）：

```text
低价信号 · SIN → WUH
出发 2026-08-21（周五）｜ TR 直飞
价格 S$268 ｜ 托运+20kg 折算 S$316
基线 当前 P6 ｜ 中位 S$412 ｜ 90天最低 S$255
触发 BaselineBreach（阈值 P15）
风险 lcc_baggage
建议 ★★★★ 立即买（同档价近90天仅出现4天）
[深链] [已购] [静音7天]
```

### 9.2 指令语法（正则解析）

| 指令 | 语法 | 返回 |
|---|---|---|
| `/fare` | `/fare SIN WUH [2026-08]` | 该航线未来 60 天（或指定月）价格日历摘要：最低 5 天 + 当前水位分位 |
| `/watch` | `/watch SIN WUH 2026-08-21 ±3` | 登记 TripIntent，确认回执含窗口与当前窗口内最低价 |
| `/bought` | `/bought <alert_id> <价格>` | 写入 Purchase，回执含本次节省与年度累计 |
| `/mute` | `/mute SIN-WUH 7` | 静音该航线 N 天 |
| `/status` | `/status` | FR-OPS-02 健康摘要 |

## 10. 里程碑与发布计划

| 里程碑 | 范围（FR 编号） | 工时 | 出口条件 |
|---|---|---|---|
| M0 数据 spike | FR-ING-01 / 03 原型脚本，本地 + GitHub Actions 各跑通 | 0.5 天脚本 + 7 个日历日观察 | 7 天存活率 ≥ 90% → go；不达标改 SerpAPI 起步并重估成本 → 修订本 PRD 的 NFR-01 |
| M1 L1 雷达 | ING-01~04, BAS-01/02, SIG-01/05, RSK-02/03, NTF-01/02/05, OPS-01 | 约 5 人日 | 第一张真实低价信号卡送达飞书，UAT-01~04 通过 |
| M2 L2 规则 | SIG-02/03/04, NTF-03/04, ING-05, BAS-03, OPS-02 | 约 5 人日 | UAT-05~09 通过 |
| M3 调噪 | 阈值与去重参数按实际推送量校准 | 1–2 人日（分散两周） | 周告警稳定 ≤ 5 且有效率 ≥ 70% |

约束：M0 出口条件未达成前不写任何引擎代码；M1 上线即独立产生价值，M2 不阻塞 M1 运行。

## 11. 风险与依赖

| 编号 | 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|---|
| R1 | 逆向接口（fli / fast-flights）失效 | 中 | 高 | 三级降级链；采价脚本与引擎解耦，换源不动引擎 |
| R2 | GitHub Actions 出口 IP 被 Google 限流 | 中 | 中 | 降频至 1 次 / 日；或采价迁移至 Railway cron / 本地 Mac launchd |
| R3 | 基线冷启动期误报 | 高 | 低 | 前 4 周建议档整体降一级，卡片标注 low_confidence |
| R4 | SelfTransfer 组合爆炸拖垮预算 | 中 | 中 | 枢纽白名单 ≤ 4、每周 1 次、仅 round_trip 航线 |
| R5 | 告警疲劳导致工具被静音 | 中 | 高 | 周上限 + 三档建议 + 字段校验拦截低信息卡 |

外部依赖：fli / fast-flights 开源库；SerpAPI 账号（免费档）；Amadeus Self-Service 账号（P2 可后置）；飞书自定义机器人 webhook；现有 Railway 项目与 Cloudflare Worker。

## 12. 验收测试清单（UAT）

| 编号 | 用例 | 对应 FR |
|---|---|---|
| UAT-01 | 首次全量采价后 PriceSnapshot 含 ≥ 480 个日历点 | ING-01 |
| UAT-02 | 临时调高阈值构造触发 → 收到卡片，含基线三数与可反查的 evidence | SIG-01/05, NTF-01 |
| UAT-03 | 人为断 fli 源 → 自动降级 + 运维通知，当日采价完成 | ING-03, NTF-05 |
| UAT-04 | 同一低价 72h 内不重复推送 | NTF-02 |
| UAT-05 | `/fare SIN WUH` 5 秒内返回日历摘要 | NTF-03 |
| UAT-06 | LCC 报价卡片展示折算总价，缺行李费配置的承运人卡片被拦截 | RSK-03, NTF-01 |
| UAT-07 | 衔接 220 分钟的两票组合不出现在任何 Opportunity | SIG-04, RSK-01 |
| UAT-08 | 单周第 6 条告警未即时推送，出现在周日周报 | NTF-02/04 |
| UAT-09 | `/bought` 后 `/status` 与周报中的年度节省累计更新 | NTF-03, OPS-02 |
| UAT-10 | 30 天存活率报表可导出且四列齐全 | OPS-01 |

## 附录

### A. 术语表

| 术语 | 定义 |
|---|---|
| 日历扫 | 对一条航线未来 N 天逐日最低价的粗粒度批量查询，一次请求覆盖整个日期区间 |
| 详情钻取 | 对日历扫命中的具体日期发起航班级查询，获取承运人、中转、时刻 |
| lead_bucket | 出发日与采价日的间隔分桶，用于区分不同提前期下的价格分布 |
| 折算总价 | 票价 + 托运行李费（+ 口岸交通加价），用于跨承运类型可比 |
| TripIntent | 用户登记的出行意向：航线 + 中心日期 + 弹性天数 |
| 降级链 | 数据源按 fli → fast-flights → SerpAPI 顺序自动切换的容错机制 |
| 冷启动基线 | 自建样本不足时，借 SerpAPI price_insights 的典型价格区间与价格历史充当基线 |

### B. 文档关系

本 PRD 由《FareRadar-提示词评估与产品方案-v1.0》导出，方案文档中的省钱杠杆分析、数据源查证与查询预算数学为本 PRD 各阈值取值的依据。下一份交付物为技术开发文档：数据库 DDL 与索引、Provider Adapter 接口契约、GitHub Actions workflow 清单、Railway 部署与环境变量清单、飞书卡片 JSON 模板。

### C. 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-07-06 | 初版；将方案文档 B2 节 5 项待确认输入固化为 §5 默认配置 |
