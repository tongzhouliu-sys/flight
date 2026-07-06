# FareRadar 机票雷达

监控 8 条固定航线（SIN/WUH/HKG/LAX 之间）的机票价格，在历史低位时通过飞书推送信号卡。
纯发现 + 深链跳转，不预订、不支付。

## 架构

一个代码仓库、两个运行位置、一个共享数据库：

- **GitHub Actions（批处理，无常驻）**：`daily_scan`（每日 2 次）、`weekly_selftransfer` / `weekly_insights`（周一）、`weekly_report`（周日）。经 psycopg 直连 Railway Postgres 写库并直接推飞书。
- **Railway（常驻）**：FastAPI `/feishu/events`（接收指令）+ PostgreSQL。
- **数据源降级链**：fli → fast-flights → SerpAPI。

技术栈：Python 3.12、FastAPI + uvicorn、psycopg 3（无 ORM）、PyYAML。无 Docker / Redis / 队列 / 前端。

## 快速开始（本地）

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env         # 填入 DATABASE_URL 等（见下）
python scripts/bootstrap_db.py           # 建表 + 从 routes.yaml 同步 route 表（幂等）
python -m app.jobs.daily_scan            # 采价 → 基线 → 信号 → 告警
uvicorn app.api.server:app --reload      # 本地起指令 API
```

配置全部在 `config/`：`config.yaml`（阈值/预算/桶边界）、`routes.yaml`（8 航线）、`baggage_fees.yaml`（LCC 行李费）。改配置不改代码（NFR-06）。

## 环境变量（§4.4）

| 变量 | 本地 .env | GitHub Secrets | Railway |
|---|---|---|---|
| `DATABASE_URL` | ✓ 公网串 | ✓ 公网串 | ✓ 内网注入 |
| `FEISHU_WEBHOOK_URL` | ✓ | ✓ | ✓ |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | ✓ | — | ✓ |
| `FEISHU_VERIFICATION_TOKEN` | ✓ | — | ✓ |
| `SERPAPI_KEY` | ✓ | ✓ | — |
| `TZ` | Asia/Singapore | ✓ | ✓ |
| `TEST_FORCE_BREACH` | 按需 =1 | — | — |

密钥只经环境变量进入；`.env` 在 `.gitignore` 中，不入 git。

## 飞书指令

| 指令 | 语法 | 说明 |
|---|---|---|
| `/fare` | `/fare SIN WUH [2026-08]` | 价格日历：最低 5 天 + 当前分位 |
| `/watch` | `/watch SIN WUH 2026-08-21 ±3` | 登记盯价意向 |
| `/bought` | `/bought <alert_id> <价格>` | 登记已购，累计年度节省 |
| `/mute` | `/mute R1 7` | 静音航线 N 天（接受 R1 或 SIN-WUH） |
| `/status` | `/status` | 系统健康摘要 |

## 测试与验证

```bash
pytest tests/                    # 全离线纯逻辑，可断网复跑
python scripts/smoke_providers.py    # 联网冒烟：三源可用性 + 降级链（手动）
TEST_FORCE_BREACH=1 python -m app.jobs.daily_scan   # 构造触发，端到端出卡
```

## 部署手册（§14，一次性人工操作）

1. **Railway**：新建项目 → 加 PostgreSQL 插件 → 加服务（连本仓库，Procfile 自动识别）→ 按上表填环境变量（`DATABASE_URL` 用内网注入值）→ 记下 Postgres 公网连接串（`DATABASE_PUBLIC_URL`）。
2. **飞书（两个机器人）**：
   - 目标群加"自定义机器人"，取 webhook URL（不启用签名）。
   - 开放平台建自建应用：开通机器人能力；加发送消息（`im:message`）与接收消息事件权限；事件订阅 URL 填 `https://<railway 域名>/feishu/events`（此时 Railway 服务须已在线）；订阅 `im.message.receive_v1`；Encrypt Key 留空，记下 Verification Token；发布并把机器人拉进群。
3. **GitHub**：Settings → Secrets 添加 `DATABASE_URL`（公网串）、`FEISHU_WEBHOOK_URL`、`SERPAPI_KEY`。
4. **初始化**：本地配好 `.env` 后 `python scripts/bootstrap_db.py`；`workflow_dispatch` 手动触发一次 daily-scan 验证端到端。
5. **SerpAPI**：注册免费账号取 api_key（免费档 250 次/月，config 已限 200）。

## 运行手册（§15）

| 现象 | 处置 |
|---|---|
| 连续收到"降级"运维卡 | 跑 `scripts/smoke_providers.py` 定位失效源；fli 失效先 `pip install -U flights` 看上游是否已修 |
| Actions 全绿但无卡片 | 正常：无击穿即无推送；`/status` 看最近采价时间确认在跑 |
| 周告警持续 >5 且多为噪音 | 调 `alerts.threshold_percentile` 至 p10 或调大 `min_abs`；改 config 提交即生效 |
| 飞书事件握手失败 | Railway 服务未起或 URL 错；先 `GET /healthz` |
| SerpAPI 月预算 80% 告警 | 降低 insights 频率（weekly_insights 改双周）或临时禁用 serpapi 兜底 |

## 数据源核验

第三方库（fli / fast-flights）的真实 API 与差异记录见 [`app/providers/VERIFIED.md`](app/providers/VERIFIED.md)。契约 `app/providers/base.py` 冻结，库差异只在对应 provider 文件内消化。
