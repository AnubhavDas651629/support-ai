import json
from unittest.mock import AsyncMock, patch
from uuid import uuid4
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.db.dependencies import get_db
from app.models.api_key import ApiKey
from app.models.organization import Organization
from app.models.organization_setting import OrganizationSettings
from app.utils.api_key import generate_api_key, hash_api_key
from app.exceptions.rate_limit import RateLimitExceededException
from app.dependencies.widget_rate_limit import check_widget_rate_limit


# ─── Mock Fixtures & Helpers ──────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def override_db_and_rate_limit():
    async def mock_get_db():
        yield AsyncMock()

    async def mock_rate_limit():
        pass

    app.dependency_overrides[get_db] = mock_get_db
    app.dependency_overrides[check_widget_rate_limit] = mock_rate_limit
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def test_org():
    return Organization(
        id=uuid4(),
        name="Acme Widgets",
        slug="acme-widgets",
    )


@pytest.fixture
def raw_and_hashed_api_key(test_org):
    full_key, prefix, key_hash = generate_api_key()
    api_key_obj = ApiKey(
        id=uuid4(),
        organization_id=test_org.id,
        name="Widget Key",
        key_prefix=prefix,
        key_hash=key_hash,
        is_active=True,
    )
    return full_key, api_key_obj


@pytest.fixture
def test_org_settings(test_org):
    return OrganizationSettings(
        id=uuid4(),
        organization_id=test_org.id,
        widget_title="Acme Bot",
        primary_color="#10B981",
        company_logo_url="https://example.com/logo.png",
    )


# ─── Tests for Widget Config ──────────────────────────────────────────────────

@pytest.mark.asyncio
class TestWidgetConfig:
    async def test_get_widget_config_success_header(
        self, test_org, raw_and_hashed_api_key, test_org_settings, monkeypatch
    ):
        raw_key, api_key_obj = raw_and_hashed_api_key

        async def mock_get_by_hash(self, key_hash):
            return api_key_obj

        async def mock_get_org(self, organization_id):
            return test_org

        async def mock_get_settings(self, organization_id):
            return test_org_settings

        async def mock_list_kbs(self, organization_id):
            return []

        monkeypatch.setattr("app.repositories.api_key_repository.ApiKeyRepository.get_by_hash", mock_get_by_hash)
        monkeypatch.setattr("app.repositories.organization_repository.OrganizationRepository.get_by_id", mock_get_org)
        monkeypatch.setattr("app.services.organization_settings_service.OrganizationSettingsService.get_or_create_settings", mock_get_settings)
        monkeypatch.setattr("app.repositories.knowledge_base_repository.KnowledgeBaseRepository.list_by_org", mock_list_kbs)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/v1/widget/config", headers={"X-API-Key": raw_key})
            assert res.status_code == 200
            data = res.json()
            assert data["organization_id"] == str(test_org.id)
            assert data["widget_title"] == "Acme Bot"
            assert data["primary_color"] == "#10B981"
            assert data["company_logo_url"] == "https://example.com/logo.png"

    async def test_get_widget_config_success_query_param(
        self, test_org, raw_and_hashed_api_key, test_org_settings, monkeypatch
    ):
        raw_key, api_key_obj = raw_and_hashed_api_key

        monkeypatch.setattr("app.repositories.api_key_repository.ApiKeyRepository.get_by_hash", AsyncMock(return_value=api_key_obj))
        monkeypatch.setattr("app.repositories.organization_repository.OrganizationRepository.get_by_id", AsyncMock(return_value=test_org))
        monkeypatch.setattr("app.services.organization_settings_service.OrganizationSettingsService.get_or_create_settings", AsyncMock(return_value=test_org_settings))
        monkeypatch.setattr("app.repositories.knowledge_base_repository.KnowledgeBaseRepository.list_by_org", AsyncMock(return_value=[]))

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get(f"/api/v1/widget/config?api_key={raw_key}")
            assert res.status_code == 200
            assert res.json()["widget_title"] == "Acme Bot"

    async def test_get_widget_config_missing_key(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/v1/widget/config")
            assert res.status_code == 401

    async def test_get_widget_config_invalid_key(self, monkeypatch):
        monkeypatch.setattr("app.repositories.api_key_repository.ApiKeyRepository.get_by_hash", AsyncMock(return_value=None))

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/v1/widget/config", headers={"X-API-Key": "pk_live_invalid123"})
            assert res.status_code == 401


# ─── Tests for Widget Conversations ───────────────────────────────────────────

@pytest.mark.asyncio
class TestWidgetConversations:
    async def test_create_widget_conversation(
        self, test_org, raw_and_hashed_api_key, monkeypatch
    ):
        raw_key, api_key_obj = raw_and_hashed_api_key
        conv_id = uuid4()

        mock_conv = type("MockConv", (), {
            "id": conv_id,
            "organization_id": test_org.id,
            "knowledge_base_id": None,
            "title": "Website Visitor Chat",
            "created_at": "2026-08-11T12:00:00Z",
        })()

        monkeypatch.setattr("app.repositories.api_key_repository.ApiKeyRepository.get_by_hash", AsyncMock(return_value=api_key_obj))
        monkeypatch.setattr("app.repositories.organization_repository.OrganizationRepository.get_by_id", AsyncMock(return_value=test_org))
        monkeypatch.setattr("app.repositories.knowledge_base_repository.KnowledgeBaseRepository.list_by_org", AsyncMock(return_value=[]))
        monkeypatch.setattr("app.services.conversation_services.ConversationService.create_conversation", AsyncMock(return_value=mock_conv))
        monkeypatch.setattr("app.services.usage_service.UsageService.record_conversation_started", AsyncMock())
        monkeypatch.setattr("app.workers.tasks.dispatch_webhook_event_task.delay", lambda *args, **kwargs: None)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/v1/widget/conversations",
                headers={"X-API-Key": raw_key},
                json={"visitor_id": "vis_123"},
            )
            assert res.status_code == 201
            assert res.json()["conversation_id"] == str(conv_id)

    async def test_get_widget_messages_history(
        self, test_org, raw_and_hashed_api_key, monkeypatch
    ):
        raw_key, api_key_obj = raw_and_hashed_api_key
        conv_id = uuid4()

        mock_conv = type("MockConv", (), {
            "id": conv_id,
            "organization_id": test_org.id,
        })()

        mock_msg = type("MockMsg", (), {
            "id": uuid4(),
            "role": type("Role", (), {"value": "assistant"})(),
            "content": "Hello visitor!",
            "citations": None,
            "created_at": "2026-08-11T12:00:00Z",
        })()

        monkeypatch.setattr("app.repositories.api_key_repository.ApiKeyRepository.get_by_hash", AsyncMock(return_value=api_key_obj))
        monkeypatch.setattr("app.repositories.organization_repository.OrganizationRepository.get_by_id", AsyncMock(return_value=test_org))
        monkeypatch.setattr("app.services.conversation_services.ConversationService.get_conversation", AsyncMock(return_value=mock_conv))
        monkeypatch.setattr("app.services.conversation_services.ConversationService.list_messages", AsyncMock(return_value=[mock_msg]))

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get(
                f"/api/v1/widget/conversations/{conv_id}/messages",
                headers={"X-API-Key": raw_key},
            )
            assert res.status_code == 200
            data = res.json()
            assert len(data) == 1
            assert data[0]["content"] == "Hello visitor!"


# ─── Tests for Widget SSE Streaming ───────────────────────────────────────────

@pytest.mark.asyncio
class TestWidgetChatStreaming:
    async def test_stream_widget_chat_success(
        self, test_org, raw_and_hashed_api_key, monkeypatch
    ):
        raw_key, api_key_obj = raw_and_hashed_api_key
        conv_id = uuid4()

        mock_conv = type("MockConv", (), {
            "id": conv_id,
            "organization_id": test_org.id,
            "knowledge_base_id": None,
        })()

        async def mock_stream_answer(self, conversation_id, question):
            yield "Hello "
            yield "world!"

        monkeypatch.setattr("app.repositories.api_key_repository.ApiKeyRepository.get_by_hash", AsyncMock(return_value=api_key_obj))
        monkeypatch.setattr("app.repositories.organization_repository.OrganizationRepository.get_by_id", AsyncMock(return_value=test_org))
        monkeypatch.setattr("app.services.conversation_services.ConversationService.get_conversation", AsyncMock(return_value=mock_conv))
        monkeypatch.setattr("app.services.chat_services.ChatService.stream_answer", mock_stream_answer)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/v1/widget/chat/stream",
                headers={"X-API-Key": raw_key},
                json={"conversation_id": str(conv_id), "question": "Hi"},
            )
            assert res.status_code == 200
            assert "text/event-stream" in res.headers["content-type"]
            body = res.text
            assert "meta" in body
            assert "token" in body
            assert "[DONE]" in body


# ─── Tests for Rate Limiting ──────────────────────────────────────────────────

@pytest.mark.asyncio
class TestWidgetRateLimit:
    async def test_rate_limit_exceeded(self, monkeypatch):
        mock_redis = AsyncMock()
        mock_redis.incr = AsyncMock(return_value=25)  # Exceeds limit 20
        mock_redis.expire = AsyncMock()

        monkeypatch.setattr("app.dependencies.widget_rate_limit.get_redis", lambda: mock_redis)

        mock_request = type("MockReq", (), {
            "headers": {},
            "client": type("Client", (), {"host": "127.0.0.1"})(),
        })()

        with pytest.raises(RateLimitExceededException):
            await check_widget_rate_limit(request=mock_request, limit=20, window_seconds=60)
