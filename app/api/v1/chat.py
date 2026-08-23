# POST /chat
#       │
#       ▼
# ChatRouter
#       │
#       ▼
# ChatService.chat()
#       │
#       ├───────────────┐
#       │               │
# New Conversation?     Existing Conversation?
#       │               │
#       ▼               ▼
# ConversationService   ConversationService
# (create)             (get)
#       │               │
#       └───────┬───────┘
#               ▼
#          answer()
#               │
#       Save USER message
#               │
#       Retrieve Context
#               │
#       Build Prompt
#               │
#          Call GPT
#               │
#     Save ASSISTANT message
#               │
#               ▼
#         Return ChatResult
#               │
#               ▼
#          ChatResponse

from fastapi import APIRouter, Depends
from app.schemas.chat import ChatRequest, ChatResponse, CitationResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.dependencies import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.services.chat_services import ChatService
from fastapi.responses import StreamingResponse

router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)

@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    service = ChatService(session=session)

    result = await service.chat(
        conversation_id=request.conversation_id,
        knowledge_base_id=request.knowledge_base_id,
        question=request.question,
        current_user=current_user,
    )

    return ChatResponse(
        conversation_id=result.conversation_id,
        message_id=result.message_id,
        answer=result.answer,
        citations=[
            CitationResponse(
                document_id=citation.document_id,
                filename=citation.filename,
                chunk_index=citation.chunk_index,
            )
            for citation in result.citations
        ],
    )

import json

@router.post("/stream")
async def stream_chat(
    request: ChatRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.conversation_services import ConversationService
    conv_service = ConversationService(session=session)
    
    # 1. Resolve or create conversation to get ID before streaming
    if request.conversation_id:
        conversation = await conv_service.get_conversation(
            conversation_id=request.conversation_id,
            current_user=current_user
        )
    else:
        # Create a new conversation
        conversation = await conv_service.create_conversation(
            organization_id=request.organization_id,
            knowledge_base_id=request.knowledge_base_id,
            title=request.question[:100]
        )
        # Note: We don't fire webhooks here since it's just the simulator, 
        # but if we wanted to, we could. The actual chat service will fire message webhooks.

    async def sse_event_stream():
        # First event: Send conversation metadata
        initial_meta = json.dumps({
            "type": "meta",
            "conversation_id": str(conversation.id),
        })
        yield f"data: {initial_meta}\n\n"
        
        service = ChatService(session=session)
        async for chunk in service.stream_answer(
            conversation_id=conversation.id,
            question=request.question,
        ):
            if isinstance(chunk, dict):
                chunk_data = json.dumps({"type": "citations", **chunk})
            else:
                chunk_data = json.dumps({"type": "token", "content": chunk})
            yield f"data: {chunk_data}\n\n"
            
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream"
    )



