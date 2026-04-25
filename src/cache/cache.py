_cache: dict = {}

def get_cached(key: str):
    return _cache.get(key)

def set_cached(key: str, value: dict):
    _cache[key] = value