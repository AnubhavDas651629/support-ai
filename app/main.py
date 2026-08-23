from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.db.dependencies import get_db
from app.api.v1 import documents
from app.api.v1.auth import router as auth_router
from app.api.v1 import chat
from app.api.v1 import messages
from app.api.v1 import ticket_events
from app.api.v1 import ticket
from app.api.v1 import ticket_notes
from app.api.v1 import test_celery
from app.api.v1 import test_redis
from app.api.v1 import organization_settings
from app.api.v1 import api_keys
from app.api.v1 import webhooks
from app.api.v1 import widget
from app.api.v1 import conversations
from app.api.v1 import knowledge_bases
from app.api.v1.users import router as users_router
from app.api.v1.organization_member import router as organization_member_router
from app.api.v1.organizations import router as organization_router
from app.core.exception_handlers import register_exception_handlers
from app.core.lifespan import lifespan
from app.api.v1.subscription import router as subscription_router, webhook_router as stripe_webhook_router
from app.api.v1 import usage
from app.api.v1 import health
from app.core.logging import setup_logging
from app.middleware.logging_middleware import LoggingMiddleware
from asgi_correlation_id import CorrelationIdMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import sentry_sdk
from prometheus_fastapi_instrumentator import Instrumentator
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from app.core.config import settings

# initialize sentry(error tracking)
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=1.0, #captures 100% of the errors
        send_default_pii=True,
    )

app = FastAPI(
    title="SupportAI",
    description="AI-powered customer support platform",
    version="0.1.0",
    lifespan=lifespan
)
#this is basically the factory in the back of the room that actaully prints the log to your terminal(or send it to aws)
#Because of the custom add_correlation_id function we wrote, the Factory pauses and says: "Wait, let me look at the sticky-note on this request's shirt."
setup_logging(json_logs=False)

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    # Prevent browsers from guessing the file type (prevents malicious uploads)
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Prevent other websites from putting your app in an invisible iframe (Clickjacking)
    response.headers["X-Frame-Options"] = "DENY"
    # Force browsers to use HTTPS
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


#the last middleware you add in the code is the first one that runs when a request arrives
app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.add_middleware(LoggingMiddleware) #second step, when req walks in it clicks start on stopwatch and when it leaves, it clicks stop, and calculates how many miliseconds the visit took
app.add_middleware(CorrelationIdMiddleware) #first step,whenever an API request arrives, the middleware immediatelt slaps a unique sticky note(a correlation ID, like req-55, Now, as that request travels deep into your database, talks to Redis, or calls OpenAI, it always has req-555 attached to it
"""
When a user requests data from your API (like a list of 1,000 support tickets), your server sends it back as raw JSON text. This can be quite large (say, 500 KB) and slow to download on bad Wi-Fi.

GZipMiddleware stands at the door when the response is leaving. 
It automatically squishes (compresses) that large JSON text down to maybe 50 KB, and 
sends it to the user's browser. The browser then automatically un-squishes it.
The minimum_size=1000 setting just means: "Don't bother compressing tiny responses under
 1000 bytes, because the act of compressing takes a tiny bit of time itself."
"""
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(organization_member_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(organization_router, prefix="/api/v1")
app.include_router(knowledge_bases.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")
app.include_router(test_celery.router, prefix="/api/v1")
app.include_router(api_keys.router, prefix="/api/v1")
app.include_router(test_redis.router, prefix="/api/v1")
app.include_router(conversations.router, prefix="/api/v1")
app.include_router(ticket.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")
app.include_router(widget.router)
app.include_router(ticket_events.router, prefix="/api/v1")
app.include_router(ticket_notes.router, prefix="/api/v1")
app.include_router(subscription_router, prefix="/api/v1")
app.include_router(stripe_webhook_router, prefix="/api/v1")
app.include_router(usage.router, prefix="/api/v1")
app.include_router(organization_settings.router, prefix="/api/v1")
app.include_router(health.router, prefix="/api/v1")

#initiliaze promethues(Metrics counter)
# This creates a background counter and exposes the numbers at /metrics
Instrumentator().instrument(app).expose(app) 

# 3. Initialize OpenTelemetry (Distributed Tracing Timelines)
# This configures where the "Package Tracking" data should be sent
provider = TracerProvider()
processor = BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otlp_endpoint))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)
# This injects the tracker into all our FastAPI routes
FastAPIInstrumentor.instrument_app(app)

@app.get("/")
async def root():
    return {"message": "Welcome to SupportAI"}

@app.get("/db-test")
async def db_test():
    async for db in get_db():
        result = await db.execute(text("SELECT 1"))
        return {"result": result.scalar()}

