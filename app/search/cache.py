"""进程内 TTL 缓存（仅优化，非数据源）。

命中即返回缓存结果（标 cached=true）；未命中走实时抓价。无外部依赖、无新表。
"""
import time

_TTL_SECONDS = 1800          # 30 分钟
_store: dict[str, tuple[float, dict]] = {}


def get(key: str) -> dict | None:
    item = _store.get(key)
    if item is None:
        return None
    ts, value = item
    if time.time() - ts > _TTL_SECONDS:
        _store.pop(key, None)
        return None
    return value


def put(key: str, value: dict) -> None:
    _store[key] = (time.time(), value)


def clear() -> None:
    _store.clear()
