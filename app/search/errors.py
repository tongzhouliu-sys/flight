"""实时搜索异常。"""


class SearchError(Exception):
    """provider 全链失败 / 无实时价格等；API 层映射为 502。"""


class SearchInputError(ValueError):
    """请求参数不合法；API 层映射为 422。"""
