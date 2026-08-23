import json
from uuid import UUID
from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.dependencies import get_db
from app.dependencies.widget_auth import get_widget_organization
from app.dependencies.widget_rate_limit import check_widget_rate_limit
from app.exceptions.conversation import ConversationNotFoundException
from app.models.organization import Organization
from app.repositories.knowledge_base_repository import KnowledgeBaseRepository
from app.schemas.widget import (
    WidgetChatStreamRequest,
    WidgetConfigResponse,
    WidgetConversationCreateRequest,
    WidgetConversationResponse,
    WidgetMessageResponse,
)
from app.services.chat_services import ChatService
from app.services.conversation_services import ConversationService
from app.services.organization_settings_service import OrganizationSettingsService
from app.services.usage_service import UsageService
from app.core.webhook_events import WebhookEventType
from app.utils.webhook_payloads import serialize_conversation_payload
from app.utils.webhook_dispatch import fire_webhook_event

router = APIRouter(prefix="/api/v1/widget", tags=["widget"])


@router.get("/config", response_model=WidgetConfigResponse)
async def get_widget_config(
    organization: Organization = Depends(get_widget_organization),
    session: AsyncSession = Depends(get_db),
):
    """
    Public endpoint: Fetch widget branding, primary color, bot title, and default knowledge base.
    Used by widget.js to dynamically theme the floating chat modal.
    """
    settings_service = OrganizationSettingsService(session=session)
    org_settings = await settings_service.get_or_create_settings(
        organization_id=organization.id
    )
    kb_repo = KnowledgeBaseRepository(session=session)
    kbs = await kb_repo.list_by_org(organization_id=organization.id)
    default_kb_id = kbs[0].id if kbs else None
    return WidgetConfigResponse(
        organization_id=organization.id,
        organization_name=organization.name,
        widget_title=org_settings.widget_title,
        primary_color=org_settings.primary_color,
        company_logo_url=org_settings.company_logo_url,
        welcome_message="Hi there! How can we help you today?",
        knowledge_base_id=default_kb_id,
    )

@router.post(
    "/conversations",
    response_model=WidgetConversationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(check_widget_rate_limit)],
)
async def create_widget_conversation(
    payload: WidgetConversationCreateRequest,
    organization: Organization = Depends(get_widget_organization),
    session: AsyncSession = Depends(get_db),
):
    """
    Public endpoint: Initialize a new visitor conversation session.
    """
    kb_repo = KnowledgeBaseRepository(session=session)
    if payload.knowledge_base_id:
        kb_id = payload.knowledge_base_id
    else:
        kbs = await kb_repo.list_by_org(organization_id=organization.id)
        kb_id = kbs[0].id if kbs else None
    conv_service = ConversationService(session=session)
    conversation = await conv_service.create_conversation(
        organization_id=organization.id,
        knowledge_base_id=kb_id,
        title="Website Visitor Chat",
    )
    usage_service = UsageService(session=session)
    await usage_service.record_conversation_started(
        organization_id=organization.id
    )
    fire_webhook_event(
        str(organization.id),
        WebhookEventType.CONVERSATION_CREATED.value,
        serialize_conversation_payload(conversation),
    )
    return WidgetConversationResponse(
        conversation_id=conversation.id,
        organization_id=organization.id,
        created_at=conversation.created_at,
    )

@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[WidgetMessageResponse],
)
async def get_widget_conversation_messages(
    conversation_id: UUID,
    organization: Organization = Depends(get_widget_organization),
    session: AsyncSession = Depends(get_db),
):
    """
    Public endpoint: Retrieve message history for returning visitors across page reloads.
    """
    conv_service = ConversationService(session=session)
    conversation = await conv_service.get_conversation(
        conversation_id=conversation_id
    )
    if not conversation or conversation.organization_id != organization.id:
        raise ConversationNotFoundException()
    messages = await conv_service.list_messages(conversation_id=conversation.id)
    return [
        WidgetMessageResponse(
            id=msg.id,
            role=msg.role.value if hasattr(msg.role, "value") else str(msg.role),
            content=msg.content,
            citations=msg.citations or [],
            created_at=msg.created_at,
        )
        for msg in messages
    ]
@router.post(
    "/chat/stream",
    dependencies=[Depends(check_widget_rate_limit)],
)
async def stream_widget_chat(
    payload: WidgetChatStreamRequest,
    organization: Organization = Depends(get_widget_organization),
    session: AsyncSession = Depends(get_db),
):
    """
    Public endpoint: Stream AI responses token-by-token to website visitors via Server-Sent Events (SSE).
    """
    conv_service = ConversationService(session=session)
    kb_repo = KnowledgeBaseRepository(session=session)
    # 1. Resolve or create conversation
    if payload.conversation_id:
        conversation = await conv_service.get_conversation(
            conversation_id=payload.conversation_id
        )
        if not conversation or conversation.organization_id != organization.id:
            raise ConversationNotFoundException()
        kb_id = conversation.knowledge_base_id
    else:
        if payload.knowledge_base_id:
            kb_id = payload.knowledge_base_id
        else:
            kbs = await kb_repo.list_by_org(organization_id=organization.id)
            kb_id = kbs[0].id if kbs else None
        conversation = await conv_service.create_conversation(
            organization_id=organization.id,
            knowledge_base_id=kb_id,
            title=payload.question[:100],
        )
        usage_service = UsageService(session=session)
        await usage_service.record_conversation_started(
            organization_id=organization.id
        )
    # 2. SSE Generator
    async def sse_event_stream():
        # First event: Send conversation metadata so frontend knows the conversation_id
        initial_meta = json.dumps({
            "type": "meta",
            "conversation_id": str(conversation.id),
        })
        yield f"data: {initial_meta}\n\n"
        chat_service = ChatService(session=session)
        async for chunk in chat_service.stream_answer(
            conversation_id=conversation.id,
            question=payload.question,
        ):
            if isinstance(chunk, dict):
                chunk_data = json.dumps({"type": "citations", **chunk})
            else:
                chunk_data = json.dumps({"type": "token", "content": chunk})
            yield f"data: {chunk_data}\n\n"
        # End of stream event
        yield "data: [DONE]\n\n"
    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
