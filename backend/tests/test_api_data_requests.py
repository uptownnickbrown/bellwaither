"""Tests for the /api/engagements/{id}/data-requests endpoints."""

from httpx import AsyncClient

from app.models.engagement import Engagement


async def test_list_data_requests_empty(client: AsyncClient, seeded_engagement: Engagement):
    resp = await client.get(f"/api/engagements/{seeded_engagement.id}/data-requests")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_data_request(client: AsyncClient, seeded_engagement: Engagement):
    payload = {
        "title": "Student attendance records",
        "description": "Need last 3 years of attendance data",
        "priority": "high",
        "assigned_to": "Data Steward",
        "created_by": "Consultant",
    }
    resp = await client.post(
        f"/api/engagements/{seeded_engagement.id}/data-requests",
        json=payload,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Student attendance records"
    assert data["priority"] == "high"
    assert "id" in data


async def test_list_data_requests_after_create(client: AsyncClient, seeded_engagement: Engagement):
    payload = {"title": "Budget documents", "priority": "medium"}
    await client.post(f"/api/engagements/{seeded_engagement.id}/data-requests", json=payload)

    resp = await client.get(f"/api/engagements/{seeded_engagement.id}/data-requests")
    assert len(resp.json()) == 1


async def test_add_comment_to_data_request(client: AsyncClient, seeded_engagement: Engagement):
    # Create a data request first
    dr_resp = await client.post(
        f"/api/engagements/{seeded_engagement.id}/data-requests",
        json={"title": "Test Request"},
    )
    dr_id = dr_resp.json()["id"]

    # Add a comment
    comment_payload = {
        "author": "Jane Doe",
        "role": "consultant",
        "content": "Please provide this by Friday.",
    }
    resp = await client.post(
        f"/api/engagements/{seeded_engagement.id}/data-requests/{dr_id}/comments",
        json=comment_payload,
    )
    assert resp.status_code == 200
    assert resp.json()["author"] == "Jane Doe"
    assert resp.json()["content"] == "Please provide this by Friday."
