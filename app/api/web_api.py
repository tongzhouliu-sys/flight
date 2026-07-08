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
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from app.api.dashboard import (gather_health, gather_levels,
                               gather_recent_alerts)
from app.db import Route, load_enabled_routes
from app.search.adapter import build_chain
from app.search.errors import SearchError, SearchInputError
from app.search.models import SearchQuery
from app.search.pipeline import run_search
from app.settings import load_config, load_baggage

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


@router.post("/search/detail")
def search_detail(body: dict):
    """获取特定日期的航班航程详情。"""
    origin = body.get("origin")
    dest = body.get("dest")
    depart_date_str = body.get("depart_date")
    return_date_str = body.get("return_date")
    cabin = body.get("cabin", "ECONOMY")
    adults = int(body.get("adults", 1))

    if not origin or not dest or not depart_date_str:
        raise HTTPException(status_code=422, detail="参数缺失")

    try:
        depart_date = datetime.strptime(depart_date_str, "%Y-%m-%d").date()
        return_date = datetime.strptime(return_date_str, "%Y-%m-%d").date() if return_date_str else None
    except ValueError:
        raise HTTPException(status_code=422, detail="日期格式错误")

    try:
        chain = build_chain(cabin, adults)
        opts = chain.details(origin, dest, depart_date, return_date)
        if not opts:
            return {"option": None}

        # 选最低价选项的详情
        opt = min(opts, key=lambda o: float(o.price))

        baggage = load_baggage()
        from app.signals.risk import baggage_fee
        fee = baggage_fee(baggage, opt.carrier)
        is_lcc = fee is not None
        free_checked_bag = not is_lcc
        bag_recheck = False

        from app.notify.cards import deeplink

        return {
            "option": {
                "type": "regular",
                "type_label": "常规航班",
                "origin": origin,
                "dest": dest,
                "route_id": f"{origin}-{dest}",
                "depart_date": depart_date.isoformat(),
                "return_date": return_date.isoformat() if return_date else None,
                "base_price": float(opt.price),
                "alt_price": float(opt.price),
                "saving": 0.0,
                "currency": opt.currency,
                "risk_tags": ["lcc_baggage"] if is_lcc else [],
                "hard_block": False,
                "effective_total": float(opt.price) + fee if is_lcc else float(opt.price),
                "baggage_fee": fee,
                "stars": 0,
                "action": "关注",
                "action_color": "info",
                "explain": {
                    "headline": f"常规航班 · {opt.currency}{float(opt.price):.0f}",
                    "route": f"{origin}→{dest}",
                    "from": {"label": depart_date.isoformat(), "price": float(opt.price)},
                    "to": {"label": depart_date.isoformat(), "price": float(opt.price)},
                    "note": "",
                    "text": ""
                },
                "detail": {
                    "stops": opt.stops,
                    "carrier": opt.carrier,
                    "depart_time": opt.depart_time.isoformat() if opt.depart_time else None,
                    "arrive_time": opt.arrive_time.isoformat() if opt.arrive_time else None,
                    "layover_cities": opt.layover_cities or [],
                },
                "deeplink": deeplink(origin, dest, depart_date, return_date),
                "layover_cities": opt.layover_cities or [],
                "free_checked_bag": free_checked_bag,
                "bag_recheck": bag_recheck,
            }
        }
    except Exception as e:
        log.warning("search_detail failed: %s", e)
        raise HTTPException(status_code=502, detail=f"获取航班详情失败：{e}")



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
