from uuid import UUID
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.dependencies import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.subscription import SubscriptionResponse, PlanLimitsResponse
from app.services.subscription_service import SubscriptionServices
from app.core.plan_config import PLAN_LIMITS, PlanTier

from app.schemas.subscription import CheckoutResponse, CheckoutRequest, PortalRequest


router = APIRouter(
    prefix="/organizations/{organization_id}/subscription",
    tags=["Subscriptions"]
)

# Separate router for Stripe webhook — no org_id in path because Stripe calls a fixed URL
webhook_router = APIRouter(
    prefix="/stripe",
    tags=["Stripe Webhook"]
)

@router.get("", response_model=SubscriptionResponse)
async def get_subscription(
    organization_id: UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = SubscriptionServices(session=session)
    sub = await service.get_or_create_subscription(
        organization_id=organization_id
    )
    tier_limits = PLAN_LIMITS.get(
        sub.plan_tier, PLAN_LIMITS[PlanTier.FREE]
    )

    return SubscriptionResponse(
        id = sub.id,
        organization_id=sub.organization_id,
        plan_tier=sub.plan_tier,
        status=sub.status,
        current_period_start=sub.current_period_start,
        current_period_end=sub.current_period_end,
        limits=PlanLimitsResponse(**tier_limits),
        has_billing_account=sub.stripe_customer_id is not None,
        has_stripe_subscription=sub.stripe_subscription_id is not None,
    )


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout_session(
    organization_id: UUID,
    request: CheckoutRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    " Returns a stripe hosted checkout url, redirect the user over there"
    service = SubscriptionServices(session=session)
    url = await service.create_checkout_session(
        organization_id=organization_id,
        current_user=current_user,
        price_id=request.price_id,
        success_url=request.success_url,
        cancel_url=request.cancel_url
    )
    return CheckoutResponse(checkout_url=url)

#this for who are already in pro or enterprise mode and want to update or cancel their plans
@router.post("/portal", response_model=CheckoutResponse)
async def create_portal_session(
    organization_id: UUID, 
    request: PortalRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    "Returns a stripe billing portal url, redirect the user there to manage billing"
    service = SubscriptionServices(session=session)
    url = await service.create_portal_session(
        organization_id=organization_id,
        current_user=current_user,
        return_url=request.return_url,
    )
    return CheckoutResponse(checkout_url=url)


# ── Stripe Webhook (called by Stripe servers, not users) ─────────────
# Must be a global fixed URL — Stripe doesn't know any {organization_id}
@webhook_router.post("/webhook", status_code=200)
async def stripe_webhook(
    request: Request,
    session: AsyncSession = Depends(get_db)
):
    """Stripe calls this when payment succeeds, plan changes, or subscription is cancelled."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    service = SubscriptionServices(session=session)
    await service.handle_webhook_event(
        payload=payload,
        sig_header=sig_header
    )
    return {"status": "ok"}
