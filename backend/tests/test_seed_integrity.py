"""Tests for seed data integrity."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.framework import CriterionType
from app.seed import SQF_FRAMEWORK


def test_sqf_framework_has_9_dimensions():
    assert len(SQF_FRAMEWORK) == 9


def test_sqf_framework_has_43_components():
    total = sum(len(d["components"]) for d in SQF_FRAMEWORK)
    assert total == 43


def test_every_component_has_criteria():
    for dim in SQF_FRAMEWORK:
        for comp in dim["components"]:
            assert len(comp.get("criteria", [])) > 0, (
                f"Component {comp['code']} ({comp['name']}) has no criteria"
            )


def test_all_criterion_types_are_valid():
    valid_types = {ct.value for ct in CriterionType}
    for dim in SQF_FRAMEWORK:
        for comp in dim["components"]:
            for ctype, text in comp.get("criteria", []):
                assert ctype in valid_types, (
                    f"Invalid criterion type '{ctype}' in component {comp['code']}"
                )


async def test_seed_demo_engagement_creates_records(db_session: AsyncSession, seeded_framework):
    """Run seed_demo_engagement and verify it creates the expected records.

    We monkey-patch the session factory so seed.py writes into the test DB,
    then verify rows were created via a raw SQL count (avoids SQLite/UUID
    round-trip issues with the ORM).
    """
    import app.seed as seed_module
    from app.seed import seed_demo_engagement
    from tests.conftest import TestingSessionLocal

    original = seed_module.async_session
    seed_module.async_session = TestingSessionLocal
    try:
        await seed_demo_engagement()
    finally:
        seed_module.async_session = original

    # Verify engagement was created using raw SQL to sidestep UUID deserialization
    from sqlalchemy import text

    result = await db_session.execute(text("SELECT count(*) FROM engagements"))
    count = result.scalar()
    assert count >= 1, "seed_demo_engagement should create at least one engagement"
