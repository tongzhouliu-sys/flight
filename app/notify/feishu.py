"""飞书发送（§10.3）：自定义机器人 webhook 推送 + 自建应用回复。

无 webhook / 无应用凭证时降级为日志（本地开发与缺密钥场景不崩溃）。
"""
import json
import logging
import time

import httpx

from app.notify.cards import build_ops_card
from app.settings import settings

log = logging.getLogger("fareradar.feishu")


def push_card(card: dict) -> None:
    """自定义机器人（批处理侧）。"""
    if not settings.FEISHU_WEBHOOK_URL:
        log.warning("FEISHU_WEBHOOK_URL 未配置，跳过推送卡片")
        return
    r = httpx.post(settings.FEISHU_WEBHOOK_URL,
                   json={"msg_type": "interactive", "card": card}, timeout=10)
    r.raise_for_status()


def notify_ops(text: str) -> None:
    """运维通知（FR-NTF-05）：数据源降级 / 预算超限 / 采价失败等。"""
    log.warning("OPS: %s", text)
    try:
        push_card(build_ops_card(text))
    except Exception as e:  # 运维通知失败不得反噬主流程
        log.error("notify_ops push failed: %s", e)


_token_cache = {"v": None, "exp": 0.0}


def _tenant_token() -> str:
    """自建应用（API 侧回复用）tenant_access_token，缓存 90 分钟。"""
    if _token_cache["v"] and time.time() < _token_cache["exp"]:
        return _token_cache["v"]
    r = httpx.post(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        json={"app_id": settings.FEISHU_APP_ID, "app_secret": settings.FEISHU_APP_SECRET},
        timeout=10,
    ).json()
    _token_cache.update(v=r["tenant_access_token"], exp=time.time() + 5400)
    return _token_cache["v"]


def send_text(chat_id: str, text: str) -> None:
    if not (settings.FEISHU_APP_ID and settings.FEISHU_APP_SECRET):
        log.warning("FEISHU_APP_ID/SECRET 未配置，跳过 send_text")
        return
    httpx.post(
        "https://open.feishu.cn/open-apis/im/v1/messages",
        params={"receive_id_type": "chat_id"},
        headers={"Authorization": f"Bearer {_tenant_token()}"},
        json={"receive_id": chat_id, "msg_type": "text",
              "content": json.dumps({"text": text})},
        timeout=10,
    )
