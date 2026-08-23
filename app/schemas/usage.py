from datetime import datetime
from pydantic import BaseModel

class UsageMetric(BaseModel):
    used:int
    limit: int | None = None

class UsageSummaryResponse(BaseModel):
    period_start: datetime
    period_end: datetime
    ai_responses: UsageMetric
    ai_tokens: UsageMetric
    storage_bytes: UsageMetric
    conversations: UsageMetric