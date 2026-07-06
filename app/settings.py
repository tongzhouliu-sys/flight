"""环境变量 + YAML 配置的单例加载（NFR-06：全部阈值配置化）。

- 密钥只经环境变量进入（§2.1-7）；本模块在 import 时可选加载仓库根的 .env（本地开发用），
  已存在的环境变量优先，不覆盖。
- 配置以 SimpleNamespace 暴露点式访问：cfg.scan.horizon_days、cfg.rules.date_shift.min_pct 等。
"""
import os
from datetime import date, datetime
from pathlib import Path
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import yaml

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"


def _load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip())


_load_dotenv()


def _ns(obj):
    if isinstance(obj, dict):
        return SimpleNamespace(**{k: _ns(v) for k, v in obj.items()})
    if isinstance(obj, list):
        return [_ns(v) for v in obj]
    return obj


def _load_yaml(name: str):
    with open(CONFIG_DIR / name, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


class Settings:
    def __init__(self) -> None:
        self.DATABASE_URL = os.environ.get("DATABASE_URL", "")
        self.FEISHU_WEBHOOK_URL = os.environ.get("FEISHU_WEBHOOK_URL", "")
        self.FEISHU_APP_ID = os.environ.get("FEISHU_APP_ID", "")
        self.FEISHU_APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "")
        self.FEISHU_VERIFICATION_TOKEN = os.environ.get("FEISHU_VERIFICATION_TOKEN", "")
        self.SERPAPI_KEY = os.environ.get("SERPAPI_KEY", "")
        self.TZ = os.environ.get("TZ", "Asia/Singapore")

    @property
    def TEST_FORCE_BREACH(self) -> bool:
        # 运行期读取：UAT-02 以 `TEST_FORCE_BREACH=1 python -m app.jobs.daily_scan` 触发
        return os.environ.get("TEST_FORCE_BREACH", "") == "1"


settings = Settings()


def load_config() -> SimpleNamespace:
    """config/config.yaml → 点式命名空间。"""
    return _ns(_load_yaml("config.yaml"))


def load_baggage() -> dict:
    """config/baggage_fees.yaml → 原始 dict（含 lcc_carriers 列表与 fees_sgd 表）。"""
    return _load_yaml("baggage_fees.yaml")


def load_routes_yaml() -> list[dict]:
    """config/routes.yaml → routes 列表（bootstrap 用；运行期改从 route 表读）。"""
    return _load_yaml("routes.yaml")["routes"]


_TZ = ZoneInfo(_load_yaml("config.yaml")["timezone"])


def now_sgt() -> datetime:
    """配置时区（默认 Asia/Singapore）的当前时间。"""
    return datetime.now(_TZ)


def today_sgt() -> date:
    return now_sgt().date()


_CURRENCY_SYMBOL = {"SGD": "S$", "USD": "$", "CNY": "¥", "HKD": "HK$", "EUR": "€"}


def currency_symbol(currency: str) -> str:
    """币种代码 → 展示符号（无映射时回退代码本身）。"""
    return _CURRENCY_SYMBOL.get(currency, currency + " ")
