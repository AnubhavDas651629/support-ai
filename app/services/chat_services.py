# Question
# ↓
# Retrieve Context
# ↓
# Build Prompt
# ↓
# Call GPT
# ↓
# Return Answer

from app.services import usage_service
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.dto import citation
from app.dto.chat import ChatResult
from app.models import conversation
from app.models.message import Message, MessageRole
from app.services.base import BaseService
from app.services.conversation_services import ConversationService
from app.services.escalation_service import EscalationService
from app.services.retrieval_service import RetrievalService
from collections.abc import AsyncGenerator
from app.processing.llms.factory import LLMFactory
from app.models.document_chunk import DocumentChunk
from app.utils.prompt_loader import load_prompt
from app.repositories.knowledge_base_repository import KnowledgeBaseRepository
from app.models.user import User
from app.dto.citation import Citation
from app.services.usage_service import UsageService
from app.services.organization_settings_service import OrganizationSettingsService
from app.core.webhook_events import WebhookEventType
from app.utils.webhook_payloads import serialize_conversation_payload, serialize_message_payload
from app.utils.webhook_dispatch import fire_webhook_event
from app.agents.router import AgentRouter
from app.agents.specialists import get_specialized_system_prompt
from app.workers.tasks import compress_conversation_memory_task

class ChatService(BaseService):
    def __init__(self, session: AsyncSession):
        super().__init__(session)

        self.retrieval_service = RetrievalService(session=session)
        self.llm_provider = LLMFactory.get_provider()
        self.escalation_service = EscalationService(session=session)
        self.conversation_service = ConversationService(session=session)
        self.knowledge_base_repository = KnowledgeBaseRepository(session=session)
        self.settings_service = OrganizationSettingsService(session=session)


    def _build_messages(
        self,
        *,
        history: list[Message],
        chunks: list[DocumentChunk],
        question: str,
        route:str,
        system_prompt_override: str | None = None,
    ) -> list[dict]:
        history_text = "\n\n".join(
            f"{message.role.value}: {message.content}"
            for message in history
        )

        context_text = "\n\n".join(
            chunk.content
            for chunk in chunks
        )

        system_prompt = get_specialized_system_prompt(route)
        # add any custom instruction from the organization
        if system_prompt_override:
            system_prompt += f"\n\nAdditional Instructions:\n{system_prompt_override}"

        user_prompt = load_prompt(
            "customer_support/user"
        )
        user_prompt = user_prompt.format(
            context=context_text,
            question=question,
            history=history_text,
        )
        
        return [
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ]


    async def _generate_title(self, *, conversation: str) -> str:
        system_prompt = load_prompt(
            "conversation/title"
        )
        prompt = system_prompt.format(
            conversation=conversation,
        )

        messages = [
            {
                "role": "user",
                "content": prompt,
            }
        ]

        title, _, _ = await self.llm_provider.complete(
            messages=messages
        )
        return title.strip()

    def _build_title_context(self,*,question: str,answer: str) -> str:
        return f"""USER:{question}
                ASSISTANT:{answer}
                """

    #API calls need direct answer, they donnot want streaming answer but users like streaming answer 
    async def answer(self, *, conversation_id: UUID, question:str, limit: int =5) -> tuple[str, list[Citation], str, Message]:
        conversation = await self.conversation_service.get_conversation(
            conversation_id=conversation_id
        )
        user_message = await self.conversation_service.create_message(
            conversation_id=conversation_id,
            role=MessageRole.USER,
            content=question
        )
        fire_webhook_event(
            str(conversation.organization_id),
            WebhookEventType.MESSAGE_CREATED.value,
            serialize_message_payload(user_message, organization_id=conversation.organization_id),
        )

        history = await self.conversation_service.list_messages(
            conversation_id=conversation.id
        )

        chunks = await self.retrieval_service.retrieve(
            knowledge_base_id=conversation.knowledge_base_id,
            question=question,
            limit=limit
        )

        citations = [
            Citation(
                document_id=chunk.document_id,
                filename=chunk.document.original_filename,
                chunk_index=chunk.chunk_index
            )
            for chunk in chunks
        ]

        # 1. Usage check
        usage_service = UsageService(session=self.session)
        await usage_service.check_ai_quota(
            organization_id=conversation.organization_id
        )

        # 2. Load org's custom AI configuration (tone & temperature)
        org_settings = await self.settings_service.get_or_create_settings(
            organization_id=conversation.organization_id
        )

        router = AgentRouter()
        route = await router.route_conversation(question)

        messages = self._build_messages(
            history=history,
            chunks=chunks,
            question=question,
            route=route,
            system_prompt_override=org_settings.system_prompt_override,
        )

        if len(history) >= 10:
            compress_conversation_memory_task.delay(str(conversation.id))

        result = await self.escalation_service.process(
            conversation=conversation,
            history=history,
            chunks=chunks,
            question=question,
        )

        prompt_tokens = 0
        completion_tokens = 0
        if result.escalated and result.answer:
            final_answer = result.answer
        else:
            final_answer, prompt_tokens, completion_tokens = await self.llm_provider.complete(
                messages=messages,
                temperature=org_settings.temperature,
            )

        assistant_message = await self.conversation_service.create_message(
            conversation_id=conversation.id,
            role=MessageRole.ASSISTANT,
            content=final_answer,
            citations=[c.model_dump(mode='json') for c in citations]
        )
        fire_webhook_event(
            str(conversation.organization_id),
            WebhookEventType.MESSAGE_CREATED.value,
            serialize_message_payload(assistant_message, organization_id=conversation.organization_id),
        )

        # 3. Record AI response usage
        await usage_service.record_ai_response(
            organization_id=conversation.organization_id,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens
        )

        title = await self._generate_title(
            conversation=self._build_title_context(
                question=question,
                answer=result.answer,
            )
        )
        await self.conversation_service.update_title(
            conversation=conversation,
            title=title
        )
        return result.answer, citations, title, assistant_message


    async def stream_answer(
        self,
        *,
        conversation_id: UUID,
        question: str,
        limit: int = 5,
    ) -> AsyncGenerator[str | dict, None]:
        """Yields answer tokens as they generate, then — if the answer drew on
        any knowledge base chunks — a single terminal `{"citations": [...]}`
        dict distinguishing itself from token strings via isinstance()."""

        conversation = await self.conversation_service.get_conversation(
            conversation_id=conversation_id
        )

        user_message = await self.conversation_service.create_message(
            conversation_id=conversation.id,
            role=MessageRole.USER,
            content=question,
        )
        fire_webhook_event(
            str(conversation.organization_id),
            WebhookEventType.MESSAGE_CREATED.value,
            serialize_message_payload(user_message, organization_id=conversation.organization_id),
        )

        history = await self.conversation_service.list_messages(
            conversation_id=conversation.id
        )

        chunks = await self.retrieval_service.retrieve(
            knowledge_base_id=conversation.knowledge_base_id,
            question=question,
            limit=limit,
        )

        # 1. Usage check
        usage_service = UsageService(session=self.session)
        await usage_service.check_ai_quota(
            organization_id=conversation.organization_id
        )

        # 2. Load org's custom AI configuration
        org_settings = await self.settings_service.get_or_create_settings(
            organization_id=conversation.organization_id
        )

        router = AgentRouter()
        route = await router.route_conversation(question)

        messages = self._build_messages(
            history=history,
            chunks=chunks,
            question=question,
            route = route,
            system_prompt_override=org_settings.system_prompt_override,
        )

        if len(history) >= 10:
            compress_conversation_memory_task.delay(str(conversation.id))

        # 3. Check for escalation
        result = await self.escalation_service.process(
            conversation=conversation,
            history=history,
            chunks=chunks,
            question=question,
        )

        prompt_tokens = 0
        completion_tokens = 0
        full_answer = ""
        if result.escalated and result.answer:
            full_answer = result.answer
            words = full_answer.split(" ")
            for i, word in enumerate(words):
                yield word + (" " if i < len(words) - 1 else "")
        else:
            async for chunk in self.llm_provider.stream(
                messages=messages,
                temperature=org_settings.temperature,
            ):
                if isinstance(chunk, str):
                    full_answer += chunk
                    yield chunk
                elif isinstance(chunk, dict):
                    prompt_tokens = chunk["prompt_tokens"]
                    completion_tokens = chunk["completion_tokens"]

        citations = [
            Citation(
                document_id=chunk.document_id,
                filename=chunk.document.original_filename,
                chunk_index=chunk.chunk_index
            )
            for chunk in chunks
        ]

        if citations:
            # Terminal, non-string item: callers (SSE endpoints) distinguish
            # this from token chunks via isinstance() and emit it as its own
            # "citations" event once the answer has finished streaming.
            yield {"citations": [c.model_dump(mode="json") for c in citations]}

        assistant_message = await self.conversation_service.create_message(
            conversation_id=conversation.id,
            role=MessageRole.ASSISTANT,
            content=full_answer,
            citations=[c.model_dump(mode='json') for c in citations]
        )
        fire_webhook_event(
            str(conversation.organization_id),
            WebhookEventType.MESSAGE_CREATED.value,
            serialize_message_payload(assistant_message, organization_id=conversation.organization_id),
        )

        # 4. Record AI response usage
        await usage_service.record_ai_response(
            organization_id=conversation.organization_id,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens
        )


    async def chat(self, *, conversation_id: UUID | None, knowledge_base_id: UUID | None, question: str, current_user: User | None = None) -> ChatResult:
        if conversation_id is None:

            knowledge_base = await self.knowledge_base_repository.get_by_id(
                knowledge_base_id=knowledge_base_id,
            )
            if current_user is not None:
                await self._require_member(
                    organization_id=knowledge_base.organization_id,
                    current_user=current_user,
                )
            conversation = await self.conversation_service.create_conversation(
                organization_id=knowledge_base.organization_id,
                knowledge_base_id=knowledge_base_id,
                title=question[:100]
            )

            usage_service = UsageService(session=self.session)
            await usage_service.record_conversation_started(
                organization_id=knowledge_base.organization_id
            )
            fire_webhook_event(
                str(knowledge_base.organization_id),
                WebhookEventType.CONVERSATION_CREATED.value,
                serialize_conversation_payload(conversation),
            )

        else:
            conversation = await self.conversation_service.get_conversation(
                conversation_id=conversation_id,
                current_user=current_user,
            )

        answer, citations, title, assistant_message = await self.answer(
            conversation_id=conversation.id,
            question=question
        )
        return ChatResult(
            conversation_id=conversation.id,
            message_id=assistant_message.id,
            answer=answer,
            citations=citations
        )

    async def stream_chat(self, *, conversation_id: UUID | None, knowledge_base_id: UUID | None, question: str, current_user: User | None = None) -> AsyncGenerator[str, None]:
        if conversation_id is None:
            knowledge_base = await self.knowledge_base_repository.get_by_id(
                knowledge_base_id=knowledge_base_id
            )
            if current_user is not None:
                await self._require_member(
                    organization_id=knowledge_base.organization_id,
                    current_user=current_user,
                )
            conversation = await self.conversation_service.create_conversation(
                organization_id=knowledge_base.organization_id,
                knowledge_base_id=knowledge_base.id
            )

            usage_service = UsageService(session=self.session)
            await usage_service.record_conversation_started(
                organization_id=knowledge_base.organization_id
            )
            fire_webhook_event(
                str(knowledge_base.organization_id),
                WebhookEventType.CONVERSATION_CREATED.value,
                serialize_conversation_payload(conversation),
            )

        else:
            conversation = await self.conversation_service.get_conversation(
                conversation_id=conversation_id,
                current_user=current_user,
            )
        async for token in self.stream_answer(
            conversation_id=conversation.id,
            question=question
        ):
            yield token





    