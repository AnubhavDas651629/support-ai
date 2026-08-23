import os
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

# Set test environment before importing app to disable OpenTelemetry/Sentry
os.environ["ENVIRONMENT"] = "test"

from app.db.dependencies import get_db
from app.main import app
from app.core.config import settings

# Create a dedicated async engine for testing
engine = create_async_engine(settings.database_url, echo=False)

@pytest_asyncio.fixture()
async def db_session():
    """
    Creates a fresh database session for a test and rolls back any changes 
    after the test completes. This ensures tests never pollute the real database!
    """
    connection = await engine.connect()
    # Begin a database transaction
    transaction = await connection.begin()
    
    # Bind an individual Session to this connection
    session = AsyncSession(bind=connection, expire_on_commit=False)
    
    yield session
    
    # After the test runs, rollback the transaction so no data is saved
    await session.close()
    await transaction.rollback()
    await connection.close()

@pytest_asyncio.fixture()
async def client(db_session):
    """
    Creates a Test Client that overrides the get_db dependency 
    to use our safe, rollback-enabled db_session.
    """
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
        
    app.dependency_overrides.clear()
