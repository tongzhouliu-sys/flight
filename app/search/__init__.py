"""实时搜索管线（Web UI 专用）。

零侵入：本包只编排、复用现有纯函数与 ProviderChain，不改任何既有业务逻辑；
实时机会为临时对象，不落 opportunity/alert 表（批任务持久化保持唯一权威）。
管线：Search → Route Expander → Provider Adapter → Opportunity Engine → Risk → Recommendation。
"""
