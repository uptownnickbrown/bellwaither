"""Layer 2: Component-level assessment agent.
Synthesizes evidence for a single SQF component and produces ratings."""

import json

from openai import AsyncOpenAI

from app.ai.model_router import AITaskType, get_model_for_task
from app.ai.prompts.system_prompts import COMPONENT_ASSESSMENT_PROMPT
from app.config import settings


async def assess_component(
    component_code: str,
    component_name: str,
    dimension_name: str,
    core_actions: list[str],
    progress_indicators: list[str],
    evidence_items: list[dict],
) -> dict:
    """Assess a single SQF component based on mapped evidence."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.COMPONENT_ASSESSMENT)

    # Format evidence for the prompt
    evidence_text = ""
    for i, ev in enumerate(evidence_items, 1):
        evidence_text += f"\n--- Evidence {i}: {ev.get('filename', 'Unknown')} ---\n"
        evidence_text += f"Type: {ev.get('evidence_type', 'unknown')}\n"
        if ev.get("summary"):
            evidence_text += f"Summary: {ev['summary']}\n"
        if ev.get("key_findings"):
            evidence_text += f"Key findings: {json.dumps(ev['key_findings'])}\n"
        if ev.get("relevant_excerpts"):
            evidence_text += f"Relevant excerpts: {json.dumps(ev['relevant_excerpts'])}\n"

    prompt = COMPONENT_ASSESSMENT_PROMPT.format(
        component_code=component_code,
        component_name=component_name,
        dimension_name=dimension_name,
        core_actions="\n".join(f"- {ca}" for ca in core_actions),
        progress_indicators="\n".join(f"- {pi}" for pi in progress_indicators),
    )

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"""Here is the evidence mapped to this component:
{evidence_text[:40000]}

Based on this evidence, provide your component assessment.
If evidence is insufficient, say so honestly.
Respond with JSON only."""}
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    result = json.loads(response.choices[0].message.content)
    result["model_used"] = model
    result["evidence_count"] = len(evidence_items)
    return result
