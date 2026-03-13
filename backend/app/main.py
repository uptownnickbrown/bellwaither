"""Meridian API: School Quality Assessment Platform."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import settings
from app.database import init_db
from app.seed import seed_demo_engagement, seed_framework

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate AI configuration on startup
    if not settings.openai_api_key:
        logger.warning("OPENAI_API_KEY is not set — all AI features will fail")
    else:
        logger.info("OpenAI API key configured (ends ...%s)", settings.openai_api_key[-4:])
    logger.info(
        "AI models: synthesis=%s extraction=%s composition=%s retrieval=%s",
        settings.model_synthesis, settings.model_extraction,
        settings.model_composition, settings.model_retrieval,
    )

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
