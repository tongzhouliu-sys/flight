# Provider 第三方库核验记录（T0 产物）

核验日期：2026-07-06 · Python 3.11.15（本机 dev；`.python-version` 固定 3.12 供 CI/Railway）

已安装并固定版本（`pip freeze`，回填至 requirements.txt）：

| 包（PyPI） | import 名 | 版本 |
|---|---|---|
| `flights` | `fli` | **0.9.0** |
| `fast-flights` | `fast_flights` | **3.0.2** |
| `httpx` | `httpx` | **0.28.1** |

> **依赖偏差（必须记录）**：Tech Spec §3 初始 requirements 固定 `httpx==0.27.2`，但 `flights==0.9.0` 依赖 `httpx>=0.28.1`，产生解析冲突。按 CLAUDE.md「依赖变化优先自行修复」+ Tech Spec「requirements 于 T0 回填精确版本」，将 httpx 提升为 `0.28.1`。飞书/SerpAPI 调用仅用 `httpx.post(...)`，该 API 在 0.28.x 无变化，无兼容影响。

---

## 1. fli（`flights` 0.9.0）—— 主力

### 导入路径（全部核验可导入）
```python
from fli.models import (Airport, PassengerInfo, SeatType, MaxStops, SortBy,
                        TripType, FlightSearchFilters, FlightSegment,
                        DateSearchFilters, FlightResult, FlightLeg, Airline, Currency)
from fli.search import SearchFlights, SearchDates, DatePrice
```

### 详情搜索：`SearchFlights().search(filters, top_n=5, currency=None, language=None, country=None)`
- **currency 是 `search()` 入参，不是 filter 字段**（Spec 参考代码此处标注"以核验为准"→ 定位为 search 入参）。
- 返回：one_way → `list[FlightResult]`；round_trip → `list[tuple[FlightResult, ...]]`（外程/回程元组）。
- `FlightSearchFilters(*, trip_type, passenger_info, flight_segments, stops, seat_type, sort_by, ...)`（全部关键字参数）。
- `FlightResult`：`price: float | None`、`currency: str | None`、`stops: int`、`legs: list[FlightLeg]`、`primary_airline: Airline | None`。**`price` 可能为 None，须过滤。**
- `FlightLeg`：`airline: Airline`、`departure_datetime: datetime`、`arrival_datetime: datetime`、`flight_number: str`、`overnight: bool`。

### **承运人二字码（关键差异）**
- `Airline` 是枚举；**枚举成员名 `.name` = IATA 二字码（如 `TR`/`HU`），`.value` = 承运人全名（如 `'Scoot'`）**。
- Spec 参考代码用 `leg0.airline.value` 取二字码是**错误**的（会得到 `'Scoot'`）；`baggage_fees.yaml` 以二字码索引 LCC，故 provider 内一律用 **`leg.airline.name`**。

### 日期区间搜索：`SearchDates().search(filters, currency=None, language=None, country=None)`
- `DateSearchFilters(*, trip_type, passenger_info, flight_segments, seat_type, stops, from_date: str, to_date: str, duration: int|None)`。
- `from_date`/`to_date` 为 `"YYYY-MM-DD"` 字符串；单次 ≤ 61 天，>61 天库内部自动分块（本项目 horizon=60，单块）。
- **one_way**：1 个 `FlightSegment`（`travel_date` 设为 `from_date` 作起始日）+ `trip_type=ONE_WAY`。
- **round_trip**：`trip_type=ROUND_TRIP` + `duration=stay_rep`，且需 **2 个 segment**，两段 `travel_date` 之差必须等于 `duration`（validator 强校验）→ seg0.travel_date=from_date、seg1.travel_date=from_date+duration。
- 返回 `list[DatePrice]`；`DatePrice.date` 是 **datetime 元组**：one_way → `(depart,)`，round_trip → `(depart, return)`；`DatePrice.price: float`、`DatePrice.currency: str|None`。

### 枚举取值
- `SeatType`: ECONOMY / PREMIUM_ECONOMY / BUSINESS / FIRST（config `cabin: ECONOMY` → `SeatType['ECONOMY']`）。
- `MaxStops`: ANY / NON_STOP / ONE_STOP_OR_FEWER / TWO_OR_FEWER_STOPS。
- `SortBy`: TOP_FLIGHTS / BEST / CHEAPEST / ...（详情用 CHEAPEST）。
- `TripType`: ROUND_TRIP / ONE_WAY / MULTI_CITY。
- `Currency`: 含 SGD（但 search 接受 str "SGD" 即可，无需枚举）。
- `Airport`: 已核验含 SIN / WUH / LAX / HKG / SZX / CAN。

### 实测（2026-07-06 联网）
- `SearchDates` R1(SIN→WUH) 未来 21–60 天：返回 **40** 个 SGD 日历点（每日 1 点）。
- `SearchFlights` R1 同参：返回 **137** 条，`price` 有值、`airline.name` 为二字码（HU）、`stops`/`departure_datetime`/`arrival_datetime` 齐全。

---

## 2. fast-flights（3.0.2）—— 备用

### 已核验 API
```python
from fast_flights import FlightData, Passengers, Result, get_flights   # 契约期望
```
- 3.0.2 顶层导出：`get_flights`、`Passengers`、`FlightData`(经 `create_filter`/model)、`Result`/`ResultList`、`create_filter`、`get_flights`。
- `get_flights(flight_data=[FlightData(date=..., from_airport=..., to_airport=...)], trip="one-way", seat="economy", passengers=Passengers(...), fetch_mode="fallback")`。
- `result.flights[i]`：`name`/`departure`/`arrival`/`duration`/`stops`/`price`（price 为字符串，含币种符号，需正则解析）。
- 无区间接口 → `calendar()` 降级为隔日单查循环（每航线 ≤ 30 次），仅 fli 失效时由 chain 触发。

### 币种解析
- 正则 `([A-Z]{0,2}\$|¥|€)?\s*([\d,]+(?:\.\d+)?)`；`S$→SGD`、`$→USD`、`¥→CNY`、`€→EUR`；未识别记 `USD` 并 warning。fast-flights 报价币种不保证 SGD，非 SGD 快照入库但按契约不进基线。

---

## 3. SerpAPI —— 兜底 + 冷启动
- 纯 HTTP（`httpx`），无第三方 SDK 依赖。`GET https://serpapi.com/search`，`engine=google_flights`，`departure_id`/`arrival_id`/`outbound_date`(/`return_date`)、`type`（2=单程,1=往返）、`currency=SGD`、`hl=en`、`api_key`。
- 响应含 `best_flights[]`/`other_flights[]` 与 `price_insights{lowest_price, typical_price_range[2], price_history[[ts,price]]}`。
- **需 `SERPAPI_KEY`**；本机未配置 → 构造期 `ProviderUnavailable`，降级链跳过；联网验证列为交接项。

---

## 4. 对上层的影响（契约不变，仅 provider 内部消化）
1. currency 经 `search(..., currency="SGD")` 传入（fli）。
2. carrier = `leg.airline.name`（二字码）。
3. round_trip 日历：2 段 + duration=stay_rep；`DatePrice.date[1]` = 回程日。
4. `FlightResult.price` 可能为 None → 过滤后再产出 `DetailOption`。
5. `base.py` 的 `CalendarPoint`/`DetailOption` 字段与语义**未改动**。
