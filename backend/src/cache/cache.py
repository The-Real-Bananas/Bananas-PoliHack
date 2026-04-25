import time
from typing import Any

_cache : dict[str, tuple[Any, float]] = {}

TTL_SECONDS = 60 * 10

def get_cached(key : str) -> Any | None:
    entry = _cache.get(key)
    if not entry:
        return None
    value, expires_at = entry
    if time.time() > expires_at:
        del _cache[key]
        return None
    return value

def set_cached(key: str, value: Any, ttl: int = TTL_SECONDS) -> None:
    _cache[key] = (value, time.time() + ttl)


def clear_cache() -> None:
    _cache.clear()