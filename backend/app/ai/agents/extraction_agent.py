"""Layer 1: Artifact-level extraction agent.
Processes individual uploaded documents and extracts structured findings."""

import json
import logging

from openai import AsyncOpenAI

from app.ai.model_router import AITaskType, get_model_for_task
from app.ai.prompts.system_prompts import ARTIFACT_EXTRACTION_PROMPT
from app.config import settings

logger = logging.getLogger(__name__)

# Default component list matching the standard SQF 9-dimension / 43-component structure.
# Used as fallback when no engagement-specific component list is provided.
DEFAULT_SQF_COMPONENT_LIST = """\
1. Organizational Purpose (1A: Mission/Vision/Values, 1B: Student Success Profile, 1C: School/Program Model)
2. Academic Program (2A: Vision/Design, 2B: Curriculum, 2C: Instruction, 2D: Data/Assessment, 2E: Intervention/Enrichment, 2F: Special Populations, 2G: Postsecondary, 2H: Instructional Technology)
3. Student Culture (3A: Vision/Design, 3B: Relationships, 3C: Community-Building, 3D: SEL, 3E: Behavior Management, 3F: Wraparound Supports)
4. Talent (4A: Philosophy, 4B: Staff Culture, 4C: Recruitment/Hiring/Onboarding, 4D: PD/Coaching/Evaluation, 4E: Career Pathways/Succession)
5. Leadership (5A: Org Structure, 5B: Decision-Making, 5C: Internal Comms, 5D: Strategic Planning, 5E: Innovation)
6. External Engagement (6A: Caregiver Engagement, 6B: Community Partnerships, 6C: External Comms/PR, 6D: Development)
7. Governance (7A: Accountability, 7B: Leader Support/Evaluation, 7C: Board Structures, 7D: Sector Engagement)
8. Operations (8A: Tech/Data Infrastructure, 8B: Physical Environment, 8C: Daily Logistics, 8D: Student Recruitment/Enrollment, 8E: Compliance)
9. Finance (9A: Financial Health, 9B: Financial Management/Controls, 9C: Financial Planning)"""


def _build_extraction_prompt(component_list: str | None = None) -> str:
    """Format the extraction prompt with the given component list (or the default SQF list)."""
    cl = component_list if component_list else DEFAULT_SQF_COMPONENT_LIST
    return ARTIFACT_EXTRACTION_PROMPT.format(component_list=cl)


async def extract_from_text(
    text: str,
    filename: str,
    evidence_type: str,
    component_list: str | None = None,
) -> dict:
    """Extract structured findings from document text.

    Args:
        text: The full document text.
        filename: Original filename for context.
        evidence_type: Type of evidence (e.g. "document").
        component_list: Optional formatted string of dimensions/components for this
            engagement's framework. Falls back to DEFAULT_SQF_COMPONENT_LIST.
    """
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.EXTRACTION)

    logger.info("Extraction started: file=%s type=%s model=%s chars=%d", filename, evidence_type, model, len(text))

    system_prompt = _build_extraction_prompt(component_list)

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"""Analyze this {evidence_type} document.
Filename: {filename}

Document content:
---
{text[:50000]}
---

Extract key findings, metrics, and suggest which framework components this evidence relates to.
Respond with JSON only."""}
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )

    result = json.loads(response.choices[0].message.content)
    result["model_used"] = model
    logger.info("Extraction completed: file=%s model=%s", filename, model)
    return result


async def extract_from_spreadsheet(
    data: list[dict],
    filename: str,
    component_list: str | None = None,
) -> dict:
    """Extract findings from spreadsheet data (already parsed to list of dicts).

    Args:
        data: Parsed spreadsheet rows as list of dicts.
        filename: Original filename for context.
        component_list: Optional formatted string of dimensions/components for this
            engagement's framework. Falls back to DEFAULT_SQF_COMPONENT_LIST.
    """
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.STRUCTURED_DATA)

    logger.info("Spreadsheet extraction started: file=%s model=%s rows=%d", filename, model, len(data))

    # Truncate large datasets for the prompt
    sample = data[:100] if len(data) > 100 else data
    data_str = json.dumps(sample, indent=2, default=str)

    system_prompt = _build_extraction_prompt(component_list)

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"""Analyze this spreadsheet data.
Filename: {filename}
Total rows: {len(data)}
Sample data (first {len(sample)} rows):
---
{data_str[:30000]}
---

Extract key metrics, patterns, and suggest which framework components this data relates to.
Respond with JSON only."""}
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )

    result = json.loads(response.choices[0].message.content)
    result["model_used"] = model
    logger.info("Spreadsheet extraction completed: file=%s model=%s", filename, model)
    return result
