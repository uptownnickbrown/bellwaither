from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    app_name: str = "Meridian API"
    database_url: str = "postgresql+asyncpg://meridian:meridian@localhost:5432/meridian"
    openai_api_key: str = ""

    # Model routing config
    model_synthesis: str = "gpt-4.1"      # High-level synthesis, scoring, global orchestration
    model_extraction: str = "gpt-4.1-mini"  # Document extraction, tagging, simple chat
    model_composition: str = "gpt-4.1"    # Report generation, action plan drafting
    model_retrieval: str = "gpt-4.1-mini"   # Evidence retrieval, search, Q&A

    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "protected_namespaces": ("settings_",)}


settings = Settings()
