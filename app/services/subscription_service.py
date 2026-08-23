from app.services import usage_service
from datetime import UTC
from datetime import datetime
from app.exceptions.subscription import PlanLimitExceededException
from app.exceptions.subscription import FeatureNotAllowedException
from app.models import User
from app.models import OrganizationSubscription
from app.models import Organization
from app.repositories.subsciption_repository import SubscriptionRepository
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.base import BaseService
from uuid import UUID
from app.core.plan_config import PlanTier, PLAN_LIMITS
import stripe
from app.core.config import settings
from app.core.plan_config import PlanTier, SubscriptionStatus
from app.services.usage_service import UsageService
from datetime import datetime, UTC

stripe.api_key = settings.stripe_secret_key

STRIPE_PRICE_TO_PLAN: dict[str, PlanTier] = {
    settings.stripe_pro_price_id: PlanTier.PRO,
    settings.stripe_enterprise_price_id: PlanTier.ENTERPRISE,
}


class SubscriptionServices(BaseService):
    def __init__(self, session: AsyncSession):
        super().__init__(session)
        self.subscription_repository = SubscriptionRepository(session)

    async def get_or_create_subscription(self, *, organization_id: UUID) -> OrganizationSubscription:
        sub = await self.subscription_repository.get_by_organization_id(organization_id=organization_id)
        if not sub:
            sub = await self.subscription_repository.create_default_free_subscription(
                organization_id=organization_id
            )
            await self.session.commit()
        return sub

    async def check_feature_allowed(self, *, Organization_id:UUID, feature_flag: str, current_user:User) -> None:
        """Check if a boolean feature flag (eg allowed api keys) is enabled for the organization's plan"""
        await self._require_member(
            organization_id=Organization_id, 
            current_user=current_user
        )
        sub = await self.get_or_create_subscription(organization_id=Organization_id)
        limits = PLAN_LIMITS.get( 
            sub.plan_tier, PLAN_LIMITS[PlanTier.FREE]
        ) # is a safe way to read value from a dictionary, if a plan tier is not found for any reason we fall back to free tier

        """
        It checks: "Is this feature disabled for the organization's current plan?"
        On Free Tier: limits.get("allows_api_keys") returns False.
        not False evaluates to True → Block access & raise Exception! 
        On Pro Tier: limits.get("allows_api_keys") returns True.
        not True evaluates to False → Skip exception & allow access! 
        """
        if not limits.get(feature_flag, False):
            raise FeatureNotAllowedException(feature_name=feature_flag.replace("_", " ").title())

    async def check_quota_limit(self, *, organization_id:UUID, quota_key:str, current_count: int) -> None:
        """check if current usage counts exceeds the plan's mac limimt"""
        sub = await self.subscription_repository.get_by_organization_id(
            organization_id=organization_id
        )
        tier = sub.plan_tier if sub else PlanTier.FREE
        limits = PLAN_LIMITS.get(
            tier, 
            PLAN_LIMITS[PlanTier.FREE]
        )
        # quota key could be = "max_knowledge_base", "max_ai_responses_per_month"
        max_allowed = limits.get(quota_key, 0)
        if current_count >= max_allowed:
            raise PlanLimitExceededException(
                message = f"You have exceeded your {tier.value} plan limit of {max_allowed} for {quota_key}.Please upgrade your plan"
            )


    async def _ensure_stripe_customer(
        self, *, organization_id: UUID, current_user: User, sub: OrganizationSubscription
    ) -> str:
        """
        Returns the organization's Stripe customer id, creating it if missing.

        Both checkout and the billing portal need a customer to point at.
        Orgs whose tier was set outside Stripe (seeded, or changed directly in
        the database) never had one, which is why the portal used to dead-end
        with a 400 — the plan buttons had nothing to open. Creating it on
        demand and persisting it means every plan action lands on a real
        Stripe page. It also guarantees the customer id is stored before
        checkout, so the customer.subscription.created webhook can always
        resolve the org even if it arrives before checkout.session.completed.
        """
        if sub.stripe_customer_id:
            return sub.stripe_customer_id

        organization = await self.organization_repository.get_by_id(organization_id)

        stripe.api_key = settings.stripe_secret_key
        customer = stripe.Customer.create(
            email=current_user.email,
            name=organization.name if organization else None,
            metadata={"organization_id": str(organization_id)},
        )

        sub.stripe_customer_id = customer.id
        await self.session.commit()
        return customer.id

    async def create_checkout_session(
        self,
        *,
        organization_id: UUID,
        current_user: User,
        price_id: str,
        success_url: str,
        cancel_url: str
    ) -> str:
        """
        Creates a Stripe hosted checkout session URL.

        The plan tier itself is never set here — only the
        `customer.subscription.created`/`updated` webhook (see
        handle_webhook_event) does that, once Stripe confirms payment. If the
        Stripe API call fails for any reason, it raises stripe.StripeError,
        which app/core/exception_handlers.py turns into a 502 — there is no
        fallback that grants a plan without a real, paid Stripe subscription.
        """
        await self._require_owner(
            organization_id=organization_id,
            current_user=current_user,
        )

        # Resolve Stripe Price ID from config if a generic tier name was passed
        actual_price_id = price_id
        if price_id in ["price_pro_monthly", "PRO", "pro"]:
            actual_price_id = settings.stripe_pro_price_id or price_id
        elif price_id in ["price_enterprise_monthly", "ENTERPRISE", "enterprise"]:
            actual_price_id = settings.stripe_enterprise_price_id or price_id

        sub = await self.get_or_create_subscription(
            organization_id=organization_id
        )

        customer_id = await self._ensure_stripe_customer(
            organization_id=organization_id,
            current_user=current_user,
            sub=sub,
        )

        stripe.api_key = settings.stripe_secret_key
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": actual_price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            customer=customer_id,
            metadata={"organization_id": str(organization_id)}
        )
        return session.url

    async def create_portal_session(
        self, *, organization_id: UUID, current_user: User, return_url: str
    ) -> str:
        """
        Creates a Stripe billing portal session URL — the page where a customer
        switches plan, updates their card, or cancels (which downgrades them to
        FREE via the customer.subscription.deleted webhook).

        The customer is created on demand when the org doesn't have one yet, so
        this never dead-ends; what the portal offers still depends on what the
        customer actually has in Stripe.
        """
        await self._require_owner(
            organization_id=organization_id,
            current_user=current_user,
        )
        sub = await self.get_or_create_subscription(
            organization_id=organization_id
        )

        customer_id = await self._ensure_stripe_customer(
            organization_id=organization_id,
            current_user=current_user,
            sub=sub,
        )

        stripe.api_key = settings.stripe_secret_key
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url
        )
        return session.url

    async def handle_webhook_event(self, *, payload:bytes, sig_header: str) -> None:
        """
        Verifies the strip webhook signature and processees the event

        webhook -> when somthing happens in strip(payment succeeded, sub cancelled) stripe sends an HTTP post req to our server at /stripe/webhook and sends a JSON body
        when stripe sends the webhook it also adds a special HTTP header:
        stripe-signature: t=1723456789,v1=a1b2c3d4e5f6...,v1=another_hash
        t -> timestampt of whne strip sent the req
        v1 -> HMAC-SHA 256 hash of that stripe computed using:
        HMAC_SHA256(key=your_webhook_secret, message="{timestamp}.{raw_body}")


        This is the function that actually upgrades/downgrades/cancels plan
        NEVER trust payload without verifying the signature first
        If the signature check fails, stripe raises an exception, we let it propogate
        """

        # 1 ->recompute the hash, if they match -> the genuinely came from stripe
        # 2-> check the timestamp, it verifies if t= timestamp is recent
        # 3-> if everything passes, it returns a python dict of events to use it:
        # event["type"]              # "customer.subscription.updated"
        # event["data"]["object"]    # the subscription object

        event = stripe.Webhook.construct_event(
            payload=payload, 
            sig_header=sig_header,
            secret=settings.stripe_webhook_secret
        )

        event_type = event["type"]
        data = event["data"]["object"]


        #When a user completes payment on Stripe's checkout page, Stripe fires "checkout.session.completed" at your webhook
        """
        Here's what is in the data object at that moment:
        data = {
            "metadata": { "organization_id": "uuid-you-sent-when-creating-session" },
            "customer": "cus_abc123",      ← Stripe's permanent ID for this org
            "subscription": "sub_xyz789",  ← the subscription they just paid for
            ...
        }
        """
        if event_type == "checkout.session.completed":
            #first time payment, stripe gives us the customer + subscription id's
            # the actual plan update comes from "customer.subscription.created" below,
            # but we save the customer_id here using the organization_id from metadata
            org_id = data["metadata"].get("organization_id")
            customer_id = data["customer"]
            subscription_id = data["subscription"]
            
            if org_id:
                sub = await self.subscription_repository.get_by_organization_id(
                    organization_id=UUID(org_id)
                )
                if sub:
                    sub.stripe_customer_id = customer_id
                    sub.stripe_subscription_id = subscription_id
                    await self.session.commit()

        elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
            # this fires when a subscription is created OR when plan changes/ renews
            # This is where we actually update the plan tier

            customer_id = data["customer"]
            price_id = data["items"]["data"][0]["price"]["id"]
            period_end = data["current_period_end"]
            status = data["status"] #active, "past_due", "cancelled"

            sub = await self.subscription_repository.get_by_stripe_id(
                stripe_customer_id=customer_id,
            )
            if sub:
                #reset usage for the new billing period
                usage_service = UsageService(session=self.session)
                new_period_start = datetime.fromtimestamp(data["current_period_start"], tz=UTC)
                new_period_end = datetime.fromtimestamp(data["current_period_end"], tz=UTC)
                await usage_service.reset_for_new_period(
                    organization_id=sub.organization_id,
                    period_start=new_period_start,
                    period_end=new_period_end,
                )

                sub.plan_tier = STRIPE_PRICE_TO_PLAN.get(
                    price_id,
                    PlanTier.FREE
                )
                sub.stripe_subscription_id = data["id"]
                sub.current_period_end = datetime.fromtimestamp(period_end, tz = UTC)
                sub.status = SubscriptionStatus.ACTIVE if status== "active" else SubscriptionStatus.PAST_DUE
                await self.session.commit()

        elif event_type == "customer.subscription.deleted":
            #user cancelled, downgraed the free tier
            customer_id = data["customer"]
            sub = await self.subscription_repository.get_by_stripe_id(
                stripe_customer_id=customer_id
            )
            if sub:
                sub.plan_tier = PlanTier.FREE
                sub.stripe_subscription_id = None
                sub.status = SubscriptionStatus.CANCELED
                await self.session.commit()

        elif event_type == "invoice.payment_failed":
            #card declined, mark as past_due
            customer_id = data["customer"]
            sub = await self.subscription_repository.get_by_stripe_id(
                stripe_customer_id=customer_id
            )
            if sub:
                sub.status = SubscriptionStatus.PAST_DUE
                await self.session.commit()



