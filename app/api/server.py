"""FastAPI 入口（§11）：Railway 健康检查 + 飞书事件订阅唯一入口。

事件订阅不启用 Encrypt Key（留空），仅 Verification Token 校验；
飞书要求 3 秒内响应，指令实现为快速 DB 查询（无外呼）。
"""
import json
import logging

from fastapi import FastAPI, HTTPException, Request

from app.api.commands import dispatch_command
from app.notify.feishu import send_text
from app.settings import settings

log = logging.getLogger("fareradar.api")
app = FastAPI(title="FareRadar")


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.post("/feishu/events")
async def feishu_events(req: Request):
    body = await req.json()

    # 配置握手
    if body.get("type") == "url_verification":
        return {"challenge": body.get("challenge")}

    # Verification Token 校验
    if body.get("header", {}).get("token") != settings.FEISHU_VERIFICATION_TOKEN:
        raise HTTPException(status_code=401)

    if body["header"].get("event_type") == "im.message.receive_v1":
        msg = body["event"]["message"]
        if msg.get("message_type") == "text":
            text = json.loads(msg["content"])["text"].strip()
            reply = dispatch_command(text)
            if reply:
                send_text(msg.get("chat_id"), reply)
    return {"code": 0}
