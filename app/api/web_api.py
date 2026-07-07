"""Web UI 的 JSON API（新增 REST，前缀 /api）。

- POST /api/search        实时搜索管线（Search Pipeline），返回原始结果 + 推荐机会
- GET  /api/routes        监控航线（8 条），供表单快填/建议
- GET  /api/health        系统健康（复用 dashboard.gather_health）
- GET  /api/levels        各航线价格水位（复用 dashboard.gather_levels）
- GET  /api/alerts/recent 批任务近期信号（复用 dashboard.gather_recent_alerts）

只读端点复用现有查询；搜索端点复用 app.search 管线。同步 def → FastAPI 线程池执行
（内部含阻塞式 DB / provider I/O），不阻塞事件循环。
"""
import logging

from fastapi import APIRouter, HTTPException, Query

from app.api.dashboard import (gather_health, gather_levels,
                               gather_recent_alerts)
from app.db import Route, load_enabled_routes
from app.search.errors import SearchError, SearchInputError
from app.search.models import SearchQuery
from app.search.pipeline import run_search
from app.settings import load_config

log = logging.getLogger("fareradar.web_api")
router = APIRouter(prefix="/api")


def _route_dict(r: Route) -> dict:
    return {
        "id": r.id, "origin": r.origin, "dest": r.dest,
        "trip_type": r.trip_type, "tier": r.tier,
        "nearby_airports": r.nearby_airports,
        "stay_rep": r.stay_rep, "enabled": r.enabled,
    }


@router.post("/search")
def search(body: dict):
    """实时搜索。参数：origin, dest, depart_date, return_date?, trip_type, cabin, adults, date_mode。"""
    try:
        query = SearchQuery.parse(body)
    except SearchInputError as e:
        raise HTTPException(status_code=422, detail=str(e))
    try:
        return run_search(query)
    except SearchError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:                       # DB / provider 未就绪等
        log.warning("search failed: %s", e)
        raise HTTPException(status_code=502, detail=f"搜索失败：{e}")


@router.get("/routes")
def routes():
    try:
        return {"routes": [_route_dict(r) for r in load_enabled_routes()]}
    except Exception as e:
        log.warning("routes query failed: %s", e)
        raise HTTPException(status_code=503, detail="数据库未就绪")


@router.get("/health")
def health():
    try:
        return gather_health(load_config())
    except Exception as e:
        log.warning("health query failed: %s", e)
        raise HTTPException(status_code=503, detail="数据库未就绪")


@router.get("/levels")
def levels():
    try:
        return {"levels": gather_levels(load_config())}
    except Exception as e:
        log.warning("levels query failed: %s", e)
        raise HTTPException(status_code=503, detail="数据库未就绪")


@router.get("/alerts/recent")
def alerts_recent(limit: int = Query(25, ge=1, le=100)):
    try:
        rows = gather_recent_alerts(limit)
        return {"alerts": [_alert_dict(a) for a in rows]}
    except Exception as e:
        log.warning("alerts query failed: %s", e)
        raise HTTPException(status_code=503, detail="数据库未就绪")


def _alert_dict(a: dict) -> dict:
    return {
        "id": a["id"], "status": a["status"],
        "sent_at": a["sent_at"].isoformat() if a.get("sent_at") else None,
        "type": a["type"], "route_id": a["route_id"],
        "depart_date": a["depart_date"].isoformat() if a.get("depart_date") else None,
        "alt_price": float(a["alt_price"]) if a.get("alt_price") is not None else None,
        "saving": float(a["saving"]) if a.get("saving") is not None else None,
    }
