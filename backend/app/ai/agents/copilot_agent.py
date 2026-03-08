"""Cross-cutting: AI Copilot agent for interactive Q&A."""

from openai import AsyncOpenAI

from app.ai.model_router import AITaskType, get_model_for_task
from app.ai.prompts.system_prompts import COPILOT_SYSTEM_PROMPT
from app.config import settings


async def copilot_chat(
    school_name: str,
    current_context: str,
    user_role: str,
    user_message: str,
    evidence_context: list[dict],
    conversation_history: list[dict],
) -> dict:
    """Handle an interactive copilot chat message."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.COPILOT_CHAT)

    system = COPILOT_SYSTEM_PROMPT.format(
        school_name=school_name,
        current_context=current_context,
        user_role=user_role,
    )

    # Build evidence context
    if evidence_context:
        evidence_summary = "\n\nAvailable evidence context:\n"
        for ev in evidence_context[:20]:
            evidence_summary += f"- {ev.get('filename', 'Unknown')}: {ev.get('summary', 'No summary')[:200]}\n"
        system += evidence_summary

    messages = [{"role": "system", "content": system}]

    # Add conversation history
    for msg in conversation_history[-10:]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_message})

    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.4,
    )

    return {
        "content": response.choices[0].message.content,
        "model_used": model,
    }
