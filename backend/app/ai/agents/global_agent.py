"""Layer 4: Global orchestration agent.
Produces executive-level synthesis across all dimensions."""

import json
import logging

from openai import AsyncOpenAI

from app.ai.model_router import AITaskType, get_model_for_task
from app.ai.prompts.system_prompts import GLOBAL_ORCHESTRATION_PROMPT
from app.config import settings

logger = logging.getLogger(__name__)


async def generate_global_summary(
    school_name: str,
    stage: str,
    dimension_summaries: list[dict],
) -> dict:
    """Generate a global executive summary across all dimensions."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.GLOBAL_ORCHESTRATION)

    logger.info("Global summary started: school=%s stage=%s model=%s dimensions=%d", school_name, stage, model, len(dimension_summaries))

    # Format dimension data
    dimension_text = ""
    for ds in dimension_summaries:
        dimension_text += f"\n=== {ds['name']} ===\n"
        if ds.get("overall_assessment"):
            dimension_text += f"Assessment: {ds['overall_assessment']}\n"
        if ds.get("patterns"):
            dimension_text += f"Patterns: {json.dumps(ds['patterns'])}\n"
        if ds.get("top_opportunities"):
            dimension_text += f"Opportunities: {json.dumps(ds['top_opportunities'])}\n"
        if ds.get("compounding_risks"):
            dimension_text += f"Risks: {json.dumps(ds['compounding_risks'])}\n"

    prompt = GLOBAL_ORCHESTRATION_PROMPT.format(
        school_name=school_name,
        stage=stage,
        dimension_data=dimension_text,
    )

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": "Generate the executive summary. Respond with JSON only."}
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    result = json.loads(response.choices[0].message.content)
    result["model_used"] = model
    logger.info("Global summary completed: school=%s model=%s", school_name, model)
    return result
