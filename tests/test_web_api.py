"""Web JSON API 单测（离线：TestClient + monkeypatch，不连库、不联网）。"""
import pytest
from fastapi.testclient import TestClient

from app.api import web_api
from app.api.server import app
from app.db import Route

client = TestClient(app)


def test_search_ok(monkeypatch):
    fake = {"query": {}, "results": [], "opportunities": [], "meta": {"cached": False}}
    monkeypatch.setattr(web_api, "run_search", lambda q: fake)
    resp = client.post("/api/search", json={
        "origin": "SIN", "dest": "HKG", "depart_date": "2026-08-01",
        "trip_type": "one_way", "cabin": "ECONOMY", "adults": 1, "date_mode": "flex3",
    })
    assert resp.status_code == 200
    assert resp.json() == fake


def test_search_validation_422():
    resp = client.post("/api/search", json={
        "origin": "SIN", "dest": "SIN", "date_mode": "exact", "depart_date": "2026-08-01",
    })
    assert resp.status_code == 422


def test_search_provider_failure_502(monkeypatch):
    from app.search.errors import SearchError

    def boom(_q):
        raise SearchError("all providers failed")

    monkeypatch.setattr(web_api, "run_search", boom)
    resp = client.post("/api/search", json={
        "origin": "SIN", "dest": "HKG", "depart_date": "2026-08-01", "date_mode": "exact",
    })
    assert resp.status_code == 502


def test_routes(monkeypatch):
    monkeypatch.setattr(web_api, "load_enabled_routes", lambda: [
        Route("R3", "SIN", "HKG", "one_way", None, None, None, "P0", ["SZX", "CAN"], True),
    ])
    resp = client.get("/api/routes")
    assert resp.status_code == 200
    routes = resp.json()["routes"]
    assert routes[0]["id"] == "R3" and routes[0]["nearby_airports"] == ["SZX", "CAN"]
