from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.exceptions.auth import (
    UserAlreadyExistsException,
    InvalidCredentialsException,
    PermissionDeniedException,
    UserNotFoundException,
    AlreadyOrganizationMemberException,
    ForbiddenException,
    RateLimitExceededException
)
from app.exceptions.organization import (
    OrganizationNotFoundException,
    OrganizationAlreadyExistsException,
    MemberNotFoundException,
    KnowledgeBaseNotFoundException,
    KnowledgeBaseAlreadyExistsException,
)
from app.exceptions.document import (
    DocumentNotFoundException,
    DocumentAlreadyExistsException,
)
from app.exceptions.conversation import (
    ConversationNotFoundException,
    MessageNotFoundException,
)
from app.exceptions.ticket import TicketNotFoundException, TicketAlreadyExistsException, TicketNoteNotFoundException
from app.exceptions.webhook import WebhookNotFoundException
from app.exceptions.api_key import InvalidApiKeyException, ApiKeyNotFoundException
import stripe

def register_exception_handlers(app: FastAPI):

    @app.exception_handler(stripe.SignatureVerificationError)
    async def stripe_signature_error_handler(request: Request, exc: stripe.SignatureVerificationError):
        return JSONResponse(status_code=400, content={"detail": "Invalid Stripe webhook signature"})

    @app.exception_handler(stripe.StripeError)
    async def stripe_error_handler(request: Request, exc: stripe.StripeError):
        return JSONResponse(status_code=502, content={"detail": f"Stripe error: {str(exc)}"})


    @app.exception_handler(UserAlreadyExistsException)
    async def user_exists_handler(
        request: Request,
        exc: UserAlreadyExistsException,
    ):
        return JSONResponse(
            status_code=409,
            content={
                "detail": str(exc),
            },
        )
    @app.exception_handler(InvalidCredentialsException)
    async def invalid_credentials_handler(
        request: Request,
        exc: InvalidCredentialsException,
    ):
        return JSONResponse(
            status_code=401,
            content={"detail": str(exc)},
        )

    @app.exception_handler(OrganizationNotFoundException)
    async def organization_not_found_handler(
        request: Request,
        exc: OrganizationNotFoundException,
    ):
        return JSONResponse(
            status_code=404,
            content={
                "detail": str(exc),
            }
        )

    @app.exception_handler(PermissionDeniedException)
    async def permission_denied(
        request: Request,
        exc: PermissionDeniedException,
    ):
        return JSONResponse(
            status_code=403,
            content={
                "detail": str(exc),
            }
        ) 

    @app.exception_handler(UserNotFoundException)
    async def user_not_found(
        request: Request,
        exc: UserNotFoundException,
    ):
        return JSONResponse(
            status_code=404,
            content={
                "detail": str(exc),
            }
        ) 

    @app.exception_handler(AlreadyOrganizationMemberException)
    async def already_organization_member(
        request: Request,
        exc: AlreadyOrganizationMemberException,
    ):
        return JSONResponse(
            status_code=409,
            content={
                "detail": str(exc),
            }
        ) 
    
    @app.exception_handler(OrganizationAlreadyExistsException)
    async def organization_already_exists_handler(
        request: Request,
        exc: OrganizationAlreadyExistsException,
    ):
        return JSONResponse(
            status_code=409,
            content={
                "detail": str(exc),
            },
        )

    @app.exception_handler(MemberNotFoundException)
    async def member_not_found_handler(
        request: Request,
        exc: MemberNotFoundException,
    ):
        return JSONResponse(
            status_code=404,
            content={
                "detail": str(exc),
            },
        )

    @app.exception_handler(KnowledgeBaseNotFoundException)
    async def knowledge_base_not_found_handler(
        request: Request,
        exc: KnowledgeBaseNotFoundException,
    ):
        return JSONResponse(
            status_code=404,
            content={
                "detail": str(exc),
            },
        )

    @app.exception_handler(KnowledgeBaseAlreadyExistsException)
    async def knowledge_base_already_exists_handler(
        request: Request,
        exc: KnowledgeBaseAlreadyExistsException,
    ):
        return JSONResponse(
            status_code=409,
            content={
                "detail": str(exc),
            },
        )

    @app.exception_handler(DocumentNotFoundException)
    async def document_not_found_handler(
        request: Request,
        exc: DocumentNotFoundException,
    ):
        return JSONResponse(
            status_code=404,
            content={
                "detail": str(exc),
            },
        )

    @app.exception_handler(DocumentAlreadyExistsException)
    async def document_already_exists_handler(
        request: Request,
        exc: DocumentAlreadyExistsException,
    ):
        return JSONResponse(
            status_code=409,
            content={
                "detail": str(exc),
            },
        )

    @app.exception_handler(ConversationNotFoundException)
    async def conversation_not_found_handler(
        request: Request,
        exc: ConversationNotFoundException,
    ):
        return JSONResponse(
            status_code=404,
            content={
                "detail": str(exc),
            },
        )

    @app.exception_handler(MessageNotFoundException)
    async def message_not_found_handler(
        request: Request,
        exc: MessageNotFoundException,
    ):
        return JSONResponse(
            status_code=404,
            content={
                "detail": str(exc),
            },
        )

    @app.exception_handler(TicketNotFoundException)
    async def ticket_not_found_handler(
        request: Request,
        exc: TicketNotFoundException,
    ):
        return JSONResponse(
            status_code=404,
            content={
                "detail": str(exc),
            },
        )

    @app.exception_handler(TicketAlreadyExistsException)
    async def ticket_already_exists_handler(
        request: Request,
        exc: TicketAlreadyExistsException,
    ):
        return JSONResponse(
            status_code=409,
            content={
                "detail": str(exc),
            },
        )

    @app.exception_handler(ForbiddenException)
    async def forbidden_handler(
        request: Request,
        exc: ForbiddenException,
    ):
        return JSONResponse(
            status_code=403,
            content={
                "detail": str(exc),
            },
        )

    @app.exception_handler(TicketNoteNotFoundException)
    async def ticket_note_not_found_handler(
        request: Request,
        exc: TicketNoteNotFoundException,
    ):
        return JSONResponse(
            status_code=404,
            content={
                "detail": str(exc),
            },
        )

    from app.exceptions.auth import InvalidOTPException

    @app.exception_handler(InvalidOTPException)
    async def invalid_otp_handler(
        request: Request,
        exc: InvalidOTPException,
    ):
        return JSONResponse(
            status_code=400,
            content={
                "detail": str(exc),
            },
        )


    @app.exception_handler(RateLimitExceededException)
    async def rate_limit_exceeded_handler(
        request: Request,
        exc: RateLimitExceededException,
    ):
        return JSONResponse(
            status_code=429,
            content={
                "detail": str(exc),
            },
            headers={
                "Retry-After": str(exc.retry_after),
                "X-RateLimit-Limit": str(exc.limit),
                "X-RateLimit-Remaining": "0",
            },
        )

    @app.exception_handler(WebhookNotFoundException)
    async def webhook_not_found_handler(
        request: Request,
        exc: WebhookNotFoundException,
    ):
        return JSONResponse(
            status_code=404,
            content={
                "detail": str(exc),
            },
        )

    @app.exception_handler(InvalidApiKeyException)
    async def invalid_api_key_handler(
        request: Request,
        exc: InvalidApiKeyException,
    ):
        return JSONResponse(
            status_code=401,
            content={
                "detail": str(exc),
            },
        )

    @app.exception_handler(ApiKeyNotFoundException)
    async def api_key_not_found_handler(
        request: Request,
        exc: ApiKeyNotFoundException,
    ):
        return JSONResponse(
            status_code=404,
            content={
                "detail": str(exc),
            },
        )

    from app.exceptions.subscription import (
        FeatureNotAllowedException,
        PlanLimitExceededException,
    )

    @app.exception_handler(FeatureNotAllowedException)
    async def feature_not_allowed_handler(
        request: Request,
        exc: FeatureNotAllowedException,
    ):
        return JSONResponse(
            status_code=403,
            content={
                "detail": str(exc),
            },
        )

    @app.exception_handler(PlanLimitExceededException)
    async def plan_limit_exceeded_handler(
        request: Request,
        exc: PlanLimitExceededException,
    ):
        return JSONResponse(
            status_code=403,
            content={
                "detail": str(exc),
            },
        )
