"""Layer 1: Artifact-level extraction agent.
Processes individual uploaded documents and extracts structured findings."""

import json
from openai import AsyncOpenAI
from app.config import settings
from app.ai.model_router import get_model_for_task, AITaskType
from app.ai.prompts.system_prompts import ARTIFACT_EXTRACTION_PROMPT


async def extract_from_text(text: str, filename: str, evidence_type: str) -> dict:
    """Extract structured findings from document text."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.EXTRACTION)

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
    return result


async def extract_from_spreadsheet(data: list[dict], filename: str) -> dict:
    """Extract findings from spreadsheet data (already parsed to list of dicts)."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.STRUCTURED_DATA)

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
    return result
