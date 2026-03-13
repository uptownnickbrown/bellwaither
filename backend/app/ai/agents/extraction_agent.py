"""Layer 1: Artifact-level extraction agent.
Processes individual uploaded documents and extracts structured findings."""

import json
import logging

from openai import AsyncOpenAI

from app.ai.model_router import AITaskType, get_model_for_task
from app.ai.prompts.system_prompts import ARTIFACT_EXTRACTION_PROMPT
from app.config import settings

logger = logging.getLogger(__name__)


async def extract_from_text(text: str, filename: str, evidence_type: str) -> dict:
    """Extract structured findings from document text."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.EXTRACTION)

    logger.info("Extraction started: file=%s type=%s model=%s chars=%d", filename, evidence_type, model, len(text))

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": ARTIFACT_EXTRACTION_PROMPT},
            {"role": "user", "content": f"""Analyze this {evidence_type} document.
Filename: {filename}

Document content:
---
{text[:50000]}
---

Extract key findings, metrics, and suggest which SQF components this evidence relates to.
Respond with JSON only."""}
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )

    result = json.loads(response.choices[0].message.content)
    result["model_used"] = model
    logger.info("Extraction completed: file=%s model=%s", filename, model)
    return result


async def extract_from_spreadsheet(data: list[dict], filename: str) -> dict:
    """Extract findings from spreadsheet data (already parsed to list of dicts)."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.STRUCTURED_DATA)

    logger.info("Spreadsheet extraction started: file=%s model=%s rows=%d", filename, model, len(data))

    # Truncate large datasets for the prompt
    sample = data[:100] if len(data) > 100 else data
    data_str = json.dumps(sample, indent=2, default=str)

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": ARTIFACT_EXTRACTION_PROMPT},
            {"role": "user", "content": f"""Analyze this spreadsheet data.
Filename: {filename}
Total rows: {len(data)}
Sample data (first {len(sample)} rows):
---
{data_str[:30000]}
---

Extract key metrics, patterns, and suggest which SQF components this data relates to.
Respond with JSON only."""}
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )

    result = json.loads(response.choices[0].message.content)
    result["model_used"] = model
    logger.info("Spreadsheet extraction completed: file=%s model=%s", filename, model)
    return result
