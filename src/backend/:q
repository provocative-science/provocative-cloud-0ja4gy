"""
Caching utility module for the Provocative Cloud platform.
Implements in-memory caching with optional time-to-live (TTL) for API responses.
"""

import time
from functools import wraps
from typing import Callable, Any, Dict

# In-memory cache storage
_cache_store: Dict[str, Dict[str, Any]] = {}


def cache(ttl: int = 60) -> Callable:
    """
    Decorator for caching function responses with a specified TTL.

    Args:
        ttl: Time-to-live for cache entries in seconds (default: 60)

    Returns:
        Callable: Decorated function with caching behavior
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            # Generate a cache key based on function name and arguments
            cache_key = f"{func.__name__}:{args}:{kwargs}"
            current_time = time.time()

            # Check if the result is already cached and still valid
            if cache_key in _cache_store:
                entry = _cache_store[cache_key]
                if current_time - entry['timestamp'] < ttl:
                    return entry['value']

            # Call the actual function and cache the result
            result = await func(*args, **kwargs)
            _cache_store[cache_key] = {
                'value': result,
                'timestamp': current_time
            }
            return result

        return wrapper
    return decorator

