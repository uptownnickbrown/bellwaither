"""Layer 4: Global orchestration agent.
Produces executive-level synthesis across all dimensions."""

import json
from openai import AsyncOpenAI
from app.config import settings
from app.ai.model_router import get_model_for_task, AITaskType
from app.ai.prompts.system_prompts import GLOBAL_ORCHESTRATION_PROMPT


async def generate_global_summary(
    school_name: str,
    stage: str,
    dimension_summaries: list[dict],
) -> dict:
    """Generate a global executive summary across all dimensions."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.GLOBAL_ORCHESTRATION)

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
    return result
