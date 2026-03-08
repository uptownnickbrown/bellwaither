"""Tests for the /api/engagements/{id}/evidence endpoints."""

from httpx import AsyncClient

from app.models.engagement import Engagement


async def test_list_evidence_empty(client: AsyncClient, seeded_engagement: Engagement):
    resp = await client.get(f"/api/engagements/{seeded_engagement.id}/evidence")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_upload_evidence_endpoint_exists(client: AsyncClient, seeded_engagement: Engagement):
    """The upload endpoint should exist and reject requests without a file."""
    resp = await client.post(f"/api/engagements/{seeded_engagement.id}/evidence")
    # 422 = validation error (missing file), which means the endpoint exists
    assert resp.status_code == 422
