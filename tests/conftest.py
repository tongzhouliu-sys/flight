"""纯逻辑测试 fixture（不连库、不联网）。

把仓库根加入 sys.path，使 `import app.*` 在直接运行 pytest 时可用。
"""
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest


@pytest.fixture
def lead_buckets() -> dict:
    return {"L0": [0, 13], "L1": [14, 56], "L2": [57, 9999]}


@pytest.fixture
def today() -> date:
    return date(2026, 7, 6)
