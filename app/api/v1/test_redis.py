from fastapi import APIRouter, Depends
from redis.asyncio import Redis

from app.redis.dependencies import get_redis

router = APIRouter(prefix="/redis", tags=["Redis"])


@router.get("/ping")
async def ping(redis: Redis = Depends(get_redis)):
    await redis.set("test:key", "SupportAI", ex=60)

    value = await redis.get("test:key")

    return {
        "status": "connected",
        "value": value,
    }
