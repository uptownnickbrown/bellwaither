"""Tests for the /api/framework endpoints."""

from httpx import AsyncClient


async def test_get_framework_returns_9_dimensions(client: AsyncClient, seeded_framework):
    resp = await client.get("/api/framework")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 9


async def test_get_framework_dimensions_have_components(client: AsyncClient, seeded_framework):
    resp = await client.get("/api/framework")
    data = resp.json()
    # Every dimension should have at least one component
    for dim in data:
        assert len(dim["components"]) >= 1


async def test_get_component_by_id(client: AsyncClient, seeded_framework):
    # Fetch framework to get a component id
    resp = await client.get("/api/framework")
    data = resp.json()
    comp_id = data[0]["components"][0]["id"]

    resp2 = await client.get(f"/api/framework/components/{comp_id}")
    assert resp2.status_code == 200
    comp = resp2.json()
    assert comp["id"] == comp_id
    assert "criteria" in comp


async def test_framework_total_43_components(client: AsyncClient, seeded_framework):
    resp = await client.get("/api/framework")
    data = resp.json()
    total = sum(len(dim["components"]) for dim in data)
    assert total == 43
