"""周一执行：SelfTransfer 两票拼接规则（§9.5，FR-SIG-04）。

因查询成本每周 1 次，仅 round_trip 航线，查询预算由 config.rules.self_transfer.max_queries 控制。
"""
import logging

from app.providers.chain import ProviderChain
from app.settings import load_config
from app.signals.alerts import dispatch_alerts
from app.signals.engine import RuleContext
from app.signals.rules.self_transfer import SelfTransferRule

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("fareradar.weekly_selftransfer")


def main() -> None:
    cfg = load_config()
    chain = ProviderChain(cfg)
    ctx = RuleContext(cfg)
    ctx.chain = chain                          # SelfTransferRule 依赖 provider chain
    drafts = SelfTransferRule().evaluate(ctx)
    tally = dispatch_alerts(cfg, drafts)
    log.info("self_transfer: %d drafts, dispatch=%s", len(drafts), tally)
    chain.flush_ops_log()


if __name__ == "__main__":
    main()
