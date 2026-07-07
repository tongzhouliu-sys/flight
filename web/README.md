# FareRadar Web UI

FareRadar 的轻量级 Web 管理界面：**实时搜索**任意航线并高亮低价机会（基线击穿 / 日期平移 / 邻近机场）。

- 前端：Next.js 16（App Router）+ TypeScript(strict) + Tailwind v4 + shadcn 风格组件 + Chart.js
- 与现有 Python 后端（FastAPI）通过 `/api/*` 同源代理通信（免 CORS，前后端分离）

## 架构（两套能力共存）

```
浏览器 (Next.js :3000)
  └─ /api/*  →  Next 代理 (app/api/[...path]/route.ts)  →  FastAPI (:8000) /api/*
                                                              └─ app/search 实时管线
                                                                    └─ ProviderChain（实时抓价）
```

- **实时 Search**（本 UI）：`POST /api/search` → `Search → RouteExpander → ProviderAdapter → OpportunityEngine → Risk → Recommendation`。复用现有规则/风险/建议纯函数，实时机会不落库。
- **批处理监控**（既有）：GitHub Actions 定时扫描 8 条固定航线、维护历史价格与飞书告警，保持不变。
- 缓存仅为优化（后端进程内 TTL 30 分钟），非数据源。

## 环境要求

- Node.js ≥ 20.9
- 运行中的 FareRadar FastAPI 后端（提供 `/api/*`），见仓库根 `README.md`

## 环境变量

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `FARERADAR_API_BASE` | FastAPI 后端地址（供代理转发） | `http://localhost:8000` |

复制 `.env.example` 为 `.env.local` 并按需修改。

## 本地开发

```bash
# 1) 先起后端（在仓库根，需 DATABASE_URL 等，见根 README）
uvicorn app.api.server:app --reload            # http://localhost:8000

# 2) 再起前端（在 web/）
npm install
npm run dev                                    # http://localhost:3000
```

## 构建与生产

```bash
npm run build
npm run start        # 默认 :3000；生产环境设置 FARERADAR_API_BASE 指向线上后端
```

前端可作为独立 Node 服务部署（如 Railway 新增服务），与 Python 服务并存。

## 页面

| 路由 | 说明 |
| --- | --- |
| `/` | 搜索：机场/日期/往返/舱位/人数 + 日期灵活度（精确 / ±3天 / 未来7天 / 未来30天） |
| `/results` | 结果：原始价格表 + 推荐机会卡片 + 价格曲线 |
| `/opportunity/[id]` | 机会详情：价格构成、基线水位、触发规则、风险说明、推荐原因、深链 |
| `/history` | 搜索历史（localStorage）：一键重新查询 |

## 后端 JSON API（由 FastAPI 提供）

| 端点 | 说明 |
| --- | --- |
| `POST /api/search` | 实时搜索管线，返回原始结果 + 推荐机会 |
| `GET /api/routes` | 8 条监控航线（快捷填充） |
| `GET /api/health` / `GET /api/levels` / `GET /api/alerts/recent` | 复用只读面板聚合 |

## 说明

- 机会展示后端**真实字段**：风险标签、hard-block、1–4★ 建议档、动作（立即买/关注）。
- `risk_score` / `recommendation_score` 为**预留 null 占位**；后端定义评分模型后填充，前端无需改动。
- 实时搜索会消耗后端 provider 预算（fli/fast-flights/serpapi），缓存可降低重复调用。
