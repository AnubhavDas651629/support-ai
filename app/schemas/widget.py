from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class WidgetConfigResponse(BaseModel):
    organization_id: UUID
    organization_name: str
    widget_title: str
    primary_color: str
    company_logo_url: str | None = None
    welcome_message: str = "Hi there! How can we help you today?"
    knowledge_base_id: UUID | None = None

    model_config = ConfigDict(from_attributes=True)


class WidgetConversationCreateRequest(BaseModel):
    visitor_id: str | None = Field(default=None, description="Client generated visitor UUID stored in localStorage")
    knowledge_base_id: UUID | None = Field(default=None, description="Optional KB override")


class WidgetConversationResponse(BaseModel):
    conversation_id: UUID
    organization_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WidgetChatStreamRequest(BaseModel):
    conversation_id: UUID | None = None
    question: str = Field(..., min_length=1, max_length=2000)
    knowledge_base_id: UUID | None = None
    visitor_id: str | None = None


class WidgetCitation(BaseModel):
    document_id: UUID
    filename: str
    chunk_index: int


class WidgetMessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    citations: list[WidgetCitation] = Field(default_factory=list)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
