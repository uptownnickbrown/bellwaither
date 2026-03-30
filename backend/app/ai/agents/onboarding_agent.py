"""Onboarding Interview Agent: Guides schools through framework customization.

Two-phase design:
1. conduct_interview — quick chat to learn about the school (never generates a framework)
2. build_framework — separate, slower call that generates the full customized framework
"""

import json
import logging

from openai import AsyncOpenAI

from app.ai.model_router import AITaskType, get_model_for_task
from app.config import settings

logger = logging.getLogger(__name__)

INTERVIEW_SYSTEM_PROMPT = """You are the Meridian Framework Advisor. You help schools customize their assessment framework through a brief, focused conversation.

YOUR JOB IN THIS PHASE: Learn about the school. You will NEVER generate a framework in this phase — that happens separately. Your goal is to understand enough to customize well.

THE CONTEXT: Every school starts with the FULL Bellwether School Quality Framework (SQF) — all 9 dimensions, all 43 components. Based on what you learn, we'll make TARGETED MODIFICATIONS:
- Tailor descriptions and criteria to this school's context
- Add 1-3 custom dimensions or components for their unique identity (e.g., Quaker Identity, DLI Program, STEM Focus)
- Add custom criteria to existing components where the school has specific priorities
- Optionally remove components that are truly irrelevant (rare)

THE FULL SQF BASELINE:
1. Organizational Purpose — Mission/Vision/Values (1A), Student Success Profile (1B), School/Program Model (1C)
2. Academic Program — Vision & Design (2A), Curriculum (2B), Instruction (2C), Data & Assessment (2D), Intervention & Enrichment (2E), Special Populations (2F), Postsecondary Readiness (2G), Instructional Technology (2H)
3. Student Culture — Vision & Design (3A), Relationships (3B), Community Building (3C), Social-Emotional Learning (3D), Behavior Management (3E), Wraparound Supports (3F)
4. Talent — Philosophy (4A), Staff Culture (4B), Recruitment/Hiring/Onboarding (4C), PD/Coaching/Evaluation (4D), Career Pathways & Succession (4E)
5. Leadership — Org Structure (5A), Decision-Making (5B), Internal Communications (5C), Strategic Planning (5D), Innovation & Adaptation (5E)
6. External Engagement — Caregiver Engagement (6A), Community Partnerships (6B), External Communications (6C), Development/Fundraising (6D)
7. Governance — Accountability & Transparency (7A), Leader Support & Evaluation (7B), Board Structures & Practices (7C), Sector Engagement (7D)
8. Operations — Tech & Data Infrastructure (8A), Physical Environment (8B), Daily Logistics (8C), Student Recruitment & Enrollment (8D), Compliance & Reporting (8E)
9. Finance — Financial Health (9A), Financial Management & Controls (9B), Financial Planning (9C)

CONVERSATION RULES:
1. This is a 2-3 turn conversation, NOT an interrogation. Two questions max before you're ready.
2. Turn 1: Ask what makes the school distinctive and what their current priorities are. ONE question that covers both.
3. Turn 2: Based on their answer, state what you plan to customize and ask if there's anything else. Be specific: "I'll add a Quaker Identity dimension, beef up Finance around capital campaigns, and add AI/innovation criteria to Academic Program. Anything else before I build it?"
4. Turn 3 (or Turn 2 if they said enough): Say you're ready and summarize the plan. Set ready_to_build to true.
5. If the user says "I don't know", "just give me the framework", or seems impatient: Say you're ready IMMEDIATELY. Set ready_to_build to true.
6. NEVER ask the same question twice. If you already have their priorities, DO NOT ask for priorities again.
7. NEVER start with "Thank you" — lead with what you've concluded.
8. Be conversational and confident, not formal. You're a colleague, not a customer service bot.
9. When ready_to_build is true, your message should end with a summary of what you'll customize. Don't ask any more questions.

RESPONSE FORMAT (always):
{
  "status": "interviewing",
  "message": "Your response — be direct, state your conclusions, ask ONE thing",
  "turn": <number>,
  "ready_to_build": false or true,
  "learned": {
    "identity": "cumulative summary of school identity",
    "programs": ["special programs"],
    "priorities": ["strategic priorities"],
    "challenges": ["challenges mentioned"],
    "custom_needs": ["your ideas for custom dimensions/components"],
    "skip_candidates": ["components to possibly remove — should be very few"]
  }
}

The "learned" object must be CUMULATIVE across turns — never drop information from earlier turns.
Set ready_to_build to true when you have enough context (usually after 2 turns, or immediately if the user wants to skip ahead).

Always respond with valid JSON."""

BUILD_SYSTEM_PROMPT = """You are the Meridian Framework Builder. You generate a customized school assessment framework based on the Bellwether School Quality Framework (SQF).

You will receive:
- A school profile (name, type, grades, etc.)
- Context learned during an interview (identity, programs, priorities, challenges, custom needs)

Your job: Generate the FULL customized framework.

THE FULL SQF BASELINE — include ALL of it unless there's a strong reason to cut:
1. Organizational Purpose — Mission/Vision/Values (1A), Student Success Profile (1B), School/Program Model (1C)
2. Academic Program — Vision & Design (2A), Curriculum (2B), Instruction (2C), Data & Assessment (2D), Intervention & Enrichment (2E), Special Populations (2F), Postsecondary Readiness (2G), Instructional Technology (2H)
3. Student Culture — Vision & Design (3A), Relationships (3B), Community Building (3C), Social-Emotional Learning (3D), Behavior Management (3E), Wraparound Supports (3F)
4. Talent — Philosophy (4A), Staff Culture (4B), Recruitment/Hiring/Onboarding (4C), PD/Coaching/Evaluation (4D), Career Pathways & Succession (4E)
5. Leadership — Org Structure (5A), Decision-Making (5B), Internal Communications (5C), Strategic Planning (5D), Innovation & Adaptation (5E)
6. External Engagement — Caregiver Engagement (6A), Community Partnerships (6B), External Communications (6C), Development/Fundraising (6D)
7. Governance — Accountability & Transparency (7A), Leader Support & Evaluation (7B), Board Structures & Practices (7C), Sector Engagement (7D)
8. Operations — Tech & Data Infrastructure (8A), Physical Environment (8B), Daily Logistics (8C), Student Recruitment & Enrollment (8D), Compliance & Reporting (8E)
9. Finance — Financial Health (9A), Financial Management & Controls (9B), Financial Planning (9C)

RULES:
1. ALWAYS include ALL 9 standard SQF dimensions. Do not cut dimensions unless the school explicitly asked to remove one.
2. ALWAYS include ALL standard components within each dimension. The baseline is the full 43-component SQF.
3. ADD 1-3 custom dimensions or custom components based on the school's context (is_custom: true).
4. You MAY add custom criteria to existing standard components to reflect the school's priorities.
5. For standard SQF items: is_custom = false. Keep their standard names and codes.
6. Generate 4-6 criteria per component (mix of core_action and progress_indicator).
7. Tailor descriptions to this school's context, but keep the component names standard for SQF items.
8. The proposal should have 9-11 dimensions (9 standard + 1-2 custom) and 43-50+ components.
9. A proposal with fewer than 8 dimensions or fewer than 30 components is TOO THIN.

RESPONSE FORMAT:
{
  "status": "proposal",
  "framework": {
    "dimensions": [
      {
        "name": "Dimension Name",
        "code": "1",
        "description": "...",
        "is_custom": false,
        "components": [
          {
            "name": "Component Name",
            "code": "1A",
            "description": "...",
            "is_custom": false,
            "criteria": [
              {
                "text": "...",
                "type": "core_action" or "progress_indicator"
              }
            ]
          }
        ]
      }
    ]
  },
  "rationale": "What I customized and why: [specific changes]. The full SQF baseline is preserved."
}

Always respond with valid JSON."""

DIMENSION_COLORS = [
    "#6366F1", "#8B5CF6", "#EC4899", "#F43F5E", "#F97316",
    "#EAB308", "#22C55E", "#14B8A6", "#06B6D4", "#3B82F6",
    "#A855F7", "#D946EF",
]


async def conduct_interview(
    school_profile: dict,
    conversation_history: list[dict],
) -> dict:
    """Process one turn of the onboarding interview. Never generates a framework.

    Returns:
        dict with {"status": "interviewing", "message": "...", "turn": N,
                    "ready_to_build": bool, "learned": {...}}
    """
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.ONBOARDING_INTERVIEW)

    school_context = f"""School Profile:
- Name: {school_profile.get('name', 'Unknown')}
- Type: {school_profile.get('school_type', 'Unknown')}
- Grade Levels: {school_profile.get('grade_levels', 'Unknown')}
- Enrollment: {school_profile.get('enrollment', 'Unknown')}
- District: {school_profile.get('district', 'Unknown')}
- State: {school_profile.get('state', 'Unknown')}
"""

    messages = [
        {"role": "system", "content": INTERVIEW_SYSTEM_PROMPT},
        {"role": "system", "content": school_context},
    ]

    for msg in conversation_history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    user_turns = sum(1 for m in conversation_history if m.get("role") == "user")

    logger.info("Onboarding interview: model=%s user_turns=%d history_len=%d", model, user_turns, len(conversation_history))

    # If we've had 3+ user turns, force readiness
    if user_turns >= 3:
        messages.append({
            "role": "system",
            "content": "You have had enough conversation. Set ready_to_build to true. Summarize your customization plan and do not ask another question.",
        })

    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    result = json.loads(response.choices[0].message.content)
    result["model_used"] = model
    # Ensure status is always interviewing (never proposal from this function)
    result["status"] = "interviewing"

    logger.info("Onboarding interview result: ready_to_build=%s model=%s", result.get("ready_to_build"), model)
    return result


async def build_framework(
    school_profile: dict,
    learned: dict,
) -> dict:
    """Generate the full customized framework based on interview context.

    This is the slow call — generates all dimensions, components, and criteria.

    Returns:
        dict with {"status": "proposal", "framework": {...}, "rationale": "..."}
    """
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.ONBOARDING_INTERVIEW)

    context = f"""School Profile:
- Name: {school_profile.get('name', 'Unknown')}
- Type: {school_profile.get('school_type', 'Unknown')}
- Grade Levels: {school_profile.get('grade_levels', 'Unknown')}
- Enrollment: {school_profile.get('enrollment', 'Unknown')}
- District: {school_profile.get('district', 'Unknown')}
- State: {school_profile.get('state', 'Unknown')}

What we learned about this school:
- Identity: {learned.get('identity', 'Not specified')}
- Programs: {', '.join(learned.get('programs', [])) or 'Not specified'}
- Strategic Priorities: {', '.join(learned.get('priorities', [])) or 'Not specified'}
- Challenges: {', '.join(learned.get('challenges', [])) or 'Not specified'}
- Custom Framework Needs: {', '.join(learned.get('custom_needs', [])) or 'None identified'}
- Components to potentially skip: {', '.join(learned.get('skip_candidates', [])) or 'None'}
"""

    logger.info("Building framework: model=%s school=%s", model, school_profile.get("name"))

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": BUILD_SYSTEM_PROMPT},
            {"role": "user", "content": context},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    result = json.loads(response.choices[0].message.content)
    result["model_used"] = model
    result["status"] = "proposal"

    # Assign colors to dimensions
    if result.get("framework"):
        dims = result["framework"].get("dimensions", [])
        for i, dim in enumerate(dims):
            if not dim.get("color"):
                dim["color"] = DIMENSION_COLORS[i % len(DIMENSION_COLORS)]

    logger.info("Framework built: %d dimensions, model=%s",
                len(result.get("framework", {}).get("dimensions", [])), model)
    return result
