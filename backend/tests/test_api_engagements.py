"""Tests for the /api/engagements endpoints."""

from httpx import AsyncClient


async def test_list_engagements_empty(client: AsyncClient):
    resp = await client.get("/api/engagements")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_engagement(client: AsyncClient):
    payload = {
        "name": "Spring Assessment",
        "school_name": "Greenfield Academy",
        "school_type": "charter",
        "district": "Metro District",
        "state": "CA",
    }
    resp = await client.post("/api/engagements", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["school_name"] == "Greenfield Academy"
    assert "id" in data


async def test_get_engagement_by_id(client: AsyncClient):
    # Create first
    payload = {"name": "Fall Review", "school_name": "Oakwood School"}
    create_resp = await client.post("/api/engagements", json=payload)
    eng_id = create_resp.json()["id"]

    resp = await client.get(f"/api/engagements/{eng_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == eng_id
    assert resp.json()["school_name"] == "Oakwood School"


async def test_get_engagement_not_found(client: AsyncClient):
    fake_id = "00000000-0000-0000-0000-000000000099"
    resp = await client.get(f"/api/engagements/{fake_id}")
    assert resp.status_code == 404


async def test_list_engagements_after_create(client: AsyncClient):
    await client.post("/api/engagements", json={"name": "E1", "school_name": "S1"})
    await client.post("/api/engagements", json={"name": "E2", "school_name": "S2"})
    resp = await client.get("/api/engagements")
    assert len(resp.json()) == 2
