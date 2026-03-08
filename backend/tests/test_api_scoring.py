"""Tests for the /api/engagements/{id}/scores endpoints."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.engagement import Engagement
from app.models.scoring import ComponentScore, RatingLevel, ScoreStatus


async def test_list_scores_empty(client: AsyncClient, seeded_engagement: Engagement):
    resp = await client.get(f"/api/engagements/{seeded_engagement.id}/scores")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_scores_with_data(
    client: AsyncClient,
    db_session: AsyncSession,
    seeded_engagement: Engagement,
    seeded_framework,
):
    """Insert a score directly and verify the API returns it."""
    from sqlalchemy import select

    from app.models.framework import Component

    result = await db_session.execute(select(Component).limit(1))
    comp = result.scalar_one()

    score = ComponentScore(
        engagement_id=seeded_engagement.id,
        component_id=comp.id,
        rating=RatingLevel.MEETING,
        status=ScoreStatus.DRAFT,
        evidence_count=2,
    )
    db_session.add(score)
    await db_session.commit()

    resp = await client.get(f"/api/engagements/{seeded_engagement.id}/scores")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["rating"] == "meeting_expectations"
    assert data[0]["status"] == "draft"
    assert data[0]["evidence_count"] == 2
