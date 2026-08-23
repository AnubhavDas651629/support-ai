from openai.types.shared import responses_model
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.dependencies import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.usage import UsageSummaryResponse, UsageMetric
from app.services.usage_service import UsageService
router = APIRouter(
    prefix="/organizations/{organization_id}/usage",
    tags=["Usage"]
)

@router.get("", response_model=UsageSummaryResponse)
async def get_usage_summary(
    organization_id: UUID, 
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns current billing period vs plan limits for the org
    """
    service = UsageService(session=session)
    summary = await service.get_usage_summary(
        organization_id=organization_id,
        current_user=current_user,
    )
    return UsageSummaryResponse(
        period_start=summary["period_start"],
        period_end=summary["period_end"],
        ai_responses=UsageMetric(
            used=summary["ai_responses"]["used"],
            limit=summary["ai_responses"]["limit"],
        ),
        ai_tokens=UsageMetric(
            used=summary["ai_tokens"]["total_used"],
            limit=summary["ai_tokens"]["limit"],
        ),
        storage_bytes=UsageMetric(
            used=summary["storage_bytes"]["used"],
            limit=summary["storage_bytes"]["limit"],
        ),
        conversations=UsageMetric(
            used=summary["conversations"]["used"],
            limit=None,  # no hard cap on conversations currently
        ),
    )
