"""Tests for the /api/engagements/{id}/threads and messages endpoints."""

from httpx import AsyncClient

from app.models.engagement import Engagement
from app.models.messaging import MessageThread


async def test_list_threads_empty(client: AsyncClient, seeded_engagement: Engagement):
    resp = await client.get(f"/api/engagements/{seeded_engagement.id}/threads")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_threads_with_data(
    client: AsyncClient,
    seeded_engagement: Engagement,
    seeded_thread: MessageThread,
):
    resp = await client.get(f"/api/engagements/{seeded_engagement.id}/threads")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Test Thread"


async def test_send_message(
    client: AsyncClient,
    seeded_engagement: Engagement,
    seeded_thread: MessageThread,
):
    payload = {
        "author": "Consultant A",
        "role": "consultant",
        "content": "Here is my analysis.",
    }
    resp = await client.post(
        f"/api/engagements/{seeded_engagement.id}/threads/{seeded_thread.id}/messages",
        json=payload,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["author"] == "Consultant A"
    assert data["content"] == "Here is my analysis."


async def test_list_messages(
    client: AsyncClient,
    seeded_engagement: Engagement,
    seeded_thread: MessageThread,
):
    resp = await client.get(
        f"/api/engagements/{seeded_engagement.id}/threads/{seeded_thread.id}/messages"
    )
    assert resp.status_code == 200
    data = resp.json()
    # seeded_thread fixture creates one message
    assert len(data) >= 1
    assert data[0]["content"] == "Hello world"
