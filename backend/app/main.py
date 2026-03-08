"""Meridian API: School Quality Assessment Platform."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.api.routes import router
from app.seed import seed_framework, seed_demo_engagement


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_framework()
    await seed_demo_engagement()
    yield


app = FastAPI(
    title="Meridian API",
    description="Framework-native school quality assessment platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/")
async def root():
    return {"name": "Meridian API", "version": "0.1.0", "status": "running"}
