"""飞书卡片构建 + 字段校验（§10.1）。

T2 先落地运维卡（模板 B）；信号卡（模板 A）、周报卡（模板 C）、字段校验在 T5 扩展。
卡片色见附录 A：立即买 green ｜ 关注 blue ｜ 运维 red ｜ 周报 purple。
"""
from datetime import datetime


def build_ops_card(text: str) -> dict:
    """模板 B · 运维卡：header red，正文一段 lark_md。"""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return {
        "config": {"wide_screen_mode": True},
        "header": {
            "template": "red",
            "title": {"tag": "plain_text", "content": "⚠️ FareRadar 运维通知"},
        },
        "elements": [
            {"tag": "div", "text": {"tag": "lark_md", "content": text}},
            {"tag": "note", "elements": [{"tag": "plain_text", "content": ts}]},
        ],
    }
