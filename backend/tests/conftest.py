"""Shared test fixtures: async SQLite database, test client, seeded data."""

import uuid
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.models.engagement import Engagement, EngagementStage
from app.models.messaging import Message, MessageThread, ThreadType

# ---------------------------------------------------------------------------
# In-memory SQLite engine for test isolation
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = "sqlite+aiosqlite://"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# SQLAlchemy 2.0's generic ``Uuid`` type handles SQLite natively (stores as
# CHAR(32) hex strings).  We only need a listener to register a basic adapter
# for the old PostgreSQL-dialect ``UUID(as_uuid=True)`` columns that still
# exist in the original framework/scoring/etc models.
@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_uuid_adapter(dbapi_connection, connection_record):
    """Register uuid adapter for pysqlite so uuid.UUID values are stored as hex strings."""
    import sqlite3
    sqlite3.register_adapter(uuid.UUID, lambda val: val.hex)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
async def _setup_database():
    """Create all tables before each test, drop after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="session", autouse=True)
async def _dispose_engine():
    """Dispose the async engine after all tests so the process can exit."""
    yield
    await engine.dispose()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional async session for tests."""
    async with TestingSessionLocal() as session:
        yield session


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """HTTPX AsyncClient wired to the FastAPI app with the test DB."""
    from app.main import app

    async def _override_get_db():
        async with TestingSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def seeded_framework(db_session: AsyncSession):
    """Seed the SQF framework into the test database and return dimensions."""
    from app.models.framework import Component, CriterionType, Dimension, SuccessCriterion
    from app.seed import SQF_FRAMEWORK

    dimensions = []
    for dim_data in SQF_FRAMEWORK:
        dim = Dimension(
            number=dim_data["number"],
            name=dim_data["name"],
            description=dim_data.get("description"),
            color=dim_data.get("color"),
        )
        db_session.add(dim)
        await db_session.flush()

        for comp_data in dim_data["components"]:
            comp = Component(
                dimension_id=dim.id,
                code=comp_data["code"],
                name=comp_data["name"],
                description=comp_data.get("description"),
                evidence_guidance=comp_data.get("evidence_guidance"),
            )
            db_session.add(comp)
            await db_session.flush()

            for idx, (ctype, text) in enumerate(comp_data.get("criteria", [])):
                criterion = SuccessCriterion(
                    component_id=comp.id,
                    criterion_type=CriterionType(ctype),
                    text=text,
                    order=idx,
                )
                db_session.add(criterion)

        dimensions.append(dim)

    await db_session.commit()
    return dimensions


@pytest.fixture
async def seeded_engagement(db_session: AsyncSession) -> Engagement:
    """Create a demo engagement for tests."""
    engagement = Engagement(
        name="Test Engagement",
        school_name="Test Academy",
        school_type="charter",
        district="Test District",
        state="NY",
        grade_levels="K-8",
        enrollment=500,
        stage=EngagementStage.ASSESSMENT,
    )
    db_session.add(engagement)
    await db_session.commit()
    await db_session.refresh(engagement)
    return engagement


@pytest.fixture
async def seeded_thread(db_session: AsyncSession, seeded_engagement: Engagement) -> MessageThread:
    """Create a message thread with one message."""
    thread = MessageThread(
        engagement_id=seeded_engagement.id,
        thread_type=ThreadType.GENERAL,
        title="Test Thread",
    )
    db_session.add(thread)
    await db_session.flush()

    msg = Message(
        thread_id=thread.id,
        author="Test User",
        role="consultant",
        content="Hello world",
    )
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(thread)
    return thread
