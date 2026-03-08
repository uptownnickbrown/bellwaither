"""Layer 3: Dimension-level synthesis agent.
Synthesizes across components within a single SQF dimension."""

import json
from openai import AsyncOpenAI
from app.config import settings
from app.ai.model_router import get_model_for_task, AITaskType
from app.ai.prompts.system_prompts import DIMENSION_SYNTHESIS_PROMPT


async def synthesize_dimension(
    dimension_name: str,
    component_scores: list[dict],
) -> dict:
    """Synthesize findings across all components in a dimension."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.DIMENSION_SYNTHESIS)

    # Format component data
    component_text = ""
    for cs in component_scores:
        component_text += f"\n--- {cs['code']} {cs['name']} ---\n"
        component_text += f"Rating: {cs.get('rating', 'not_rated')}\n"
        component_text += f"Confidence: {cs.get('confidence', 'unknown')}\n"
        if cs.get("strengths"):
            component_text += f"Strengths: {json.dumps(cs['strengths'])}\n"
        if cs.get("gaps"):
            component_text += f"Gaps: {json.dumps(cs['gaps'])}\n"
        if cs.get("rationale"):
            component_text += f"Rationale: {cs['rationale']}\n"

    prompt = DIMENSION_SYNTHESIS_PROMPT.format(
        dimension_name=dimension_name,
        component_data=component_text,
    )

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": "Synthesize the findings across these components. Respond with JSON only."}
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    result = json.loads(response.choices[0].message.content)
    result["model_used"] = model
    return result
