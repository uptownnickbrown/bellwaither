"""Amendment Agent: Proposes structured edits to the SQF framework.

Three-step AI pipeline + one code step:
  Step 0: plan_dimensions — keep/remove standard dims, propose custom dims
  Step 1: amend_standard_dimension / generate_custom_dimension — per-dimension
  Step 2: rationalize_amendments — coherence pass across all dimensions
  Step 3: apply_amendments — pure code, mutates the SQF tree
"""

import copy
import json
import logging

from openai import AsyncOpenAI

from app.ai.model_router import AITaskType, get_model_for_task
from app.config import settings

logger = logging.getLogger(__name__)

# Valid amendment types
AMENDMENT_TYPES = {
    "add_dimension", "remove_dimension",
    "add_component", "remove_component",
    "edit_description",
    "add_criterion", "remove_criterion", "edit_criterion",
}

DIMENSION_COLORS = [
    "#6366F1", "#8B5CF6", "#EC4899", "#F43F5E", "#F97316",
    "#EAB308", "#22C55E", "#14B8A6", "#06B6D4", "#3B82F6",
    "#A855F7", "#D946EF",
]

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

DIMENSION_PLAN_PROMPT = """You are the Meridian Framework Advisor. You help schools customize the Bellwether School Quality Framework (SQF).

You will receive a school profile and context learned from an interview. Your job is to decide the HIGH-LEVEL STRUCTURE of this school's customized framework:

1. For each of the 9 standard SQF dimensions, decide: KEEP or REMOVE.
   - Removing a dimension is RARE. Only remove if the school explicitly said it's irrelevant.
   - Default is KEEP for all dimensions.

2. Propose 0-3 NEW custom dimensions that reflect this school's unique identity.
   - Examples: "Quaker Identity & Practice", "Dual Language Program", "STEM Innovation"
   - Only propose custom dimensions for things that don't fit within the existing 9 dimensions.
   - For each custom dimension, provide a name, description, and list of proposed component names.

RESPONSE FORMAT (JSON):
{
  "standard_dimensions": [
    {"number": 1, "name": "Organizational Purpose", "action": "keep"},
    {"number": 7, "name": "Governance", "action": "remove", "rationale": "Private school, no governance board"}
  ],
  "custom_dimensions": [
    {
      "name": "Quaker Identity & Practice",
      "description": "The integration of Friends values, traditions, and practices throughout school life.",
      "proposed_components": [
        {"name": "Quaker Values Integration", "description": "How core values of peace, equality, and community are woven into daily practice"},
        {"name": "Meeting for Worship", "description": "The role and quality of Meeting for Worship in school life"}
      ]
    }
  ]
}

Be decisive. Do not over-customize — most schools keep all 9 dimensions and add 1 custom one."""

DIMENSION_AMENDMENT_PROMPT = """You are the Meridian Framework Advisor. You are reviewing ONE dimension of the School Quality Framework (SQF) for a specific school.

You will receive:
1. The school's profile and context
2. The FULL content of one SQF dimension (its components and criteria)

Your job: propose AMENDMENTS to this dimension's components and criteria to better fit this school. You are NOT reproducing the framework — you are proposing specific changes.

AMENDMENT TYPES:
- "add_component": Add a new component to this dimension
- "remove_component": Remove an existing component (rare — only if truly irrelevant)
- "edit_description": Edit the description of a component
- "add_criterion": Add a new criterion to an existing component
- "remove_criterion": Remove a criterion (rare)
- "edit_criterion": Edit the text of an existing criterion

RULES:
1. MOST components should have ZERO amendments. Only propose changes that are genuinely valuable for this school.
2. Do NOT propose amendments just to "personalize" — only if the school's context makes a real difference.
3. Additions are more common than removals. Adding a criterion about AI literacy to the Academic Program is good. Removing a standard criterion is usually bad.
4. Each amendment needs a clear rationale.
5. For edit_criterion and remove_criterion, reference the criterion by its index (0-based) in the component's criteria list.
6. For add_component, provide full content: code, name, description, and criteria.
7. Keep amendments focused on THIS dimension only. Cross-cutting concerns will be handled in a later coherence pass.
8. If this dimension needs no changes for this school, return an empty amendments list. That's fine.

RESPONSE FORMAT (JSON):
{
  "dimension_number": 1,
  "amendments": [
    {
      "type": "add_criterion",
      "component_code": "2C",
      "content": {"criterion_type": "core_action", "text": "Instruction integrates AI literacy and ethical technology use across subjects"},
      "rationale": "School prioritizes AI readiness and innovation in teaching"
    },
    {
      "type": "edit_description",
      "component_code": "6A",
      "content": {"description": "Families and the broader East Falls community are engaged as partners in the school's mission and student success"},
      "rationale": "School emphasizes deep community ties to East Falls neighborhood"
    },
    {
      "type": "add_component",
      "content": {
        "code": "6E",
        "name": "Community Service & Outreach",
        "description": "The school maintains active service programs connecting students to the local community",
        "is_custom": true,
        "criteria": [
          {"criterion_type": "core_action", "text": "Regular service learning opportunities are embedded in the curriculum"},
          {"criterion_type": "progress_indicator", "text": "Students can describe their community service experiences and their impact"}
        ]
      },
      "rationale": "School prioritizes community outreach and social good"
    }
  ]
}

If no amendments are needed for this dimension, return: {"dimension_number": N, "amendments": []}"""

CUSTOM_DIMENSION_PROMPT = """You are the Meridian Framework Advisor. You are generating the FULL CONTENT for a new custom dimension being added to a school's framework.

You will receive:
1. The school's profile and context
2. The custom dimension's name, description, and proposed component names

Your job: Generate complete components with criteria for this custom dimension.

RULES:
1. Generate 2-4 components for the dimension.
2. Each component should have 4-6 criteria (mix of core_action and progress_indicator).
3. Criteria should be specific to this school's context, not generic.
4. Use component codes like "Q1A", "Q1B" for custom dimensions (prefix with first letter of dimension name + sequential number).

RESPONSE FORMAT (JSON):
{
  "name": "Quaker Identity & Practice",
  "description": "...",
  "is_custom": true,
  "components": [
    {
      "code": "Q1A",
      "name": "Quaker Values Integration",
      "description": "...",
      "is_custom": true,
      "criteria": [
        {"criterion_type": "core_action", "text": "..."},
        {"criterion_type": "progress_indicator", "text": "..."}
      ]
    }
  ]
}"""

STUDIO_CHAT_PROMPT = """You are the Meridian Framework Advisor in REVIEW MODE. The framework has already been built and customized for this school. You are now helping the user explore, understand, and refine it.

KEY RULES:
1. You ALREADY built the framework. Never say "I'll add" or "I'll build" — use past tense ("I added", "The framework includes").
2. You have full knowledge of what amendments were applied. When asked about customizations, reference SPECIFIC components and criteria by code and name.
3. If the user asks about something that IS in the framework, describe exactly where it is (which dimension, which component, which criteria).
4. If the user asks about something that is NOT in the framework, say so clearly and offer to add it.
5. Be concise and specific. Reference component codes (e.g., "2H: Instructional Technology") when discussing the framework.
6. Stay focused on the current question. Do not bring up unrelated customizations or repeat information the user hasn't asked about.
7. You CAN apply edits to the framework. When the user asks you to make changes, include amendments in your response.

APPLYING EDITS:
When the user asks you to edit, add, remove, or move something in the framework, include an "amendments" array in your JSON response. Use the same amendment types as the build pipeline:
- "edit_description": Edit a component's description. Requires component_code and content.description.
- "add_criterion": Add a criterion. Requires component_code and content with criterion_type and text.
- "remove_criterion": Remove a criterion by index. Requires component_code and criterion_index.
- "edit_criterion": Edit a criterion. Requires component_code, criterion_index, and content with text.
- "add_component": Add a component. Requires content with code, name, description, is_custom, criteria.
- "remove_component": Remove a component. Requires component_code.

IMPORTANT FOR MOVING COMPONENTS: To move a component from one dimension to another, use BOTH remove_component (from the source dimension) AND add_component (to the target dimension). The add_component MUST include the full component content including ALL criteria with their text. Do not leave criteria empty.

Each amendment needs dimension_number and a rationale. Only include amendments when the user asks for changes. For questions/explanations, return an empty amendments array.

RESPONSE FORMAT (always JSON):
{
  "message": "Your response text (can use markdown: **bold**, *italic*, bullet lists, headings)",
  "amendments": []
}

Use markdown freely in your message — bold for emphasis, bullet lists for comparisons, headings for structure. The UI renders markdown.

You will receive the school's profile, learned context, amendments applied, current framework structure, and conversation history."""

COHERENCE_PROMPT = """You are the Meridian Framework Advisor performing a COHERENCE REVIEW.

You will receive a list of proposed amendments to a school's framework, collected from reviewing each dimension independently. Your job:

1. REMOVE DUPLICATES: If the same concept was proposed in multiple dimensions, keep the best version.
2. RESOLVE CONFLICTS: If amendments contradict each other, pick the better one.
3. CONSOLIDATE: If multiple small amendments could be one cleaner amendment, merge them.
4. VALIDATE: Drop any amendment that doesn't make sense for this school.
5. PRESERVE: Keep all amendments that are coherent and valuable. Don't over-prune.

Return the FINAL, RATIONALIZED list of amendments. Same schema as the input — each amendment has type, dimension_number, component_code (if applicable), content, and rationale.

RESPONSE FORMAT (JSON):
{
  "amendments": [
    ... the final, cleaned list of amendments ...
  ],
  "changes_made": "Brief summary of what you consolidated, removed, or resolved"
}"""


# ---------------------------------------------------------------------------
# Step 0: Dimension Plan
# ---------------------------------------------------------------------------

async def plan_dimensions(
    school_profile: dict,
    learned: dict,
    dimension_names: list[dict],
) -> dict:
    """Decide keep/remove for standard dimensions and propose custom ones."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.ONBOARDING_AMENDMENT_PLAN)

    dim_list = "\n".join(
        f"  {d['number']}. {d['name']}" for d in dimension_names
    )
    context = _build_school_context(school_profile, learned)

    logger.info("Step 0 (dimension plan): model=%s", model)
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": DIMENSION_PLAN_PROMPT},
            {"role": "user", "content": f"{context}\n\nThe 9 standard SQF dimensions:\n{dim_list}"},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    result = json.loads(response.choices[0].message.content)
    logger.info("Step 0 result: keep=%d remove=%d custom=%d",
                sum(1 for d in result.get("standard_dimensions", []) if d.get("action") == "keep"),
                sum(1 for d in result.get("standard_dimensions", []) if d.get("action") == "remove"),
                len(result.get("custom_dimensions", [])))
    return result


# ---------------------------------------------------------------------------
# Step 1a: Amend Standard Dimension
# ---------------------------------------------------------------------------

async def amend_standard_dimension(
    school_profile: dict,
    learned: dict,
    dimension_data: dict,
) -> dict:
    """Propose amendments for one standard SQF dimension."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.ONBOARDING_AMENDMENT_DIMENSION)

    context = _build_school_context(school_profile, learned)
    dim_text = _format_dimension_for_prompt(dimension_data)

    logger.info("Step 1 (amend dimension %d: %s): model=%s",
                dimension_data["number"], dimension_data["name"], model)
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": DIMENSION_AMENDMENT_PROMPT},
            {"role": "user", "content": f"{context}\n\n--- DIMENSION TO REVIEW ---\n{dim_text}"},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    result = json.loads(response.choices[0].message.content)
    logger.info("Step 1 result for dim %d: %d amendments",
                dimension_data["number"], len(result.get("amendments", [])))
    return result


# ---------------------------------------------------------------------------
# Step 1b: Generate Custom Dimension
# ---------------------------------------------------------------------------

async def generate_custom_dimension(
    school_profile: dict,
    learned: dict,
    dim_spec: dict,
) -> dict:
    """Generate full content for a new custom dimension."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.ONBOARDING_AMENDMENT_DIMENSION)

    context = _build_school_context(school_profile, learned)
    spec_text = json.dumps(dim_spec, indent=2)

    logger.info("Step 1 (generate custom dimension: %s): model=%s", dim_spec.get("name"), model)
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": CUSTOM_DIMENSION_PROMPT},
            {"role": "user", "content": f"{context}\n\n--- CUSTOM DIMENSION SPEC ---\n{spec_text}"},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    result = json.loads(response.choices[0].message.content)
    logger.info("Step 1 result for custom dim '%s': %d components",
                dim_spec.get("name"), len(result.get("components", [])))
    return result


# ---------------------------------------------------------------------------
# Step 2: Coherence Pass
# ---------------------------------------------------------------------------

async def rationalize_amendments(
    school_profile: dict,
    all_amendments: list[dict],
) -> list[dict]:
    """Review all amendments for coherence, dedup, and conflicts."""
    if not all_amendments:
        logger.info("Step 2 (coherence): no amendments to rationalize")
        return []

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.ONBOARDING_AMENDMENT_COHERENCE)

    context = _build_school_context(school_profile, {})
    amendments_text = json.dumps(all_amendments, indent=2)

    logger.info("Step 2 (coherence): model=%s, %d input amendments", model, len(all_amendments))
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": COHERENCE_PROMPT},
            {"role": "user", "content": f"{context}\n\n--- PROPOSED AMENDMENTS ---\n{amendments_text}"},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    result = json.loads(response.choices[0].message.content)
    final = result.get("amendments", [])
    changes = result.get("changes_made", "")
    logger.info("Step 2 result: %d → %d amendments. Changes: %s",
                len(all_amendments), len(final), changes)
    return final


# ---------------------------------------------------------------------------
# Studio Chat (post-build)
# ---------------------------------------------------------------------------

async def studio_chat(
    school_profile: dict,
    learned: dict,
    amendments: list[dict],
    framework_summary: list[dict],
    conversation_history: list[dict],
    message: str,
) -> str:
    """Answer questions about the customized framework in the studio.

    Returns a plain text response (not JSON).
    """
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.ONBOARDING_AMENDMENT_COHERENCE)  # use strong model

    school_context = _build_school_context(school_profile, learned)

    # Format amendments as readable text
    amendments_text = ""
    if amendments:
        lines = []
        for a in amendments:
            dim = a.get("dimension_number", "?")
            comp = a.get("component_code", "")
            desc = a.get("rationale", "")
            atype = a.get("type", "")
            if atype == "add_dimension":
                name = a.get("content", {}).get("name", "Custom")
                lines.append(f"  - Added custom dimension: {name} ({desc})")
            elif atype == "add_component":
                name = a.get("content", {}).get("name", "")
                lines.append(f"  - Dim {dim}: Added component {name} ({desc})")
            elif atype == "add_criterion":
                text = a.get("content", {}).get("text", "")[:80]
                lines.append(f"  - Dim {dim}, {comp}: Added criterion: {text}... ({desc})")
            elif atype == "edit_description":
                lines.append(f"  - Dim {dim}, {comp}: Edited description ({desc})")
            elif atype == "edit_criterion":
                lines.append(f"  - Dim {dim}, {comp}: Edited criterion ({desc})")
            elif atype == "remove_component":
                lines.append(f"  - Dim {dim}: Removed component {comp} ({desc})")
            elif atype == "remove_dimension":
                lines.append(f"  - Removed dimension {dim} ({desc})")
            else:
                lines.append(f"  - {atype} on dim {dim} {comp} ({desc})")
        amendments_text = "\n".join(lines)

    # Format framework summary compactly
    fw_lines = []
    for dim in framework_summary:
        custom_tag = " [CUSTOM]" if dim.get("is_custom") else ""
        fw_lines.append(f"Dim {dim.get('number', '?')}: {dim.get('name', '?')}{custom_tag}")
        for comp in dim.get("components", []):
            comp_custom = " [CUSTOM]" if comp.get("is_custom") else ""
            fw_lines.append(f"  {comp.get('code', '?')}: {comp.get('name', '?')}{comp_custom}")
    framework_text = "\n".join(fw_lines)

    system_content = f"""{STUDIO_CHAT_PROMPT}

--- SCHOOL CONTEXT ---
{school_context}

--- AMENDMENTS APPLIED ({len(amendments)} total) ---
{amendments_text or "No amendments were applied."}

--- CURRENT FRAMEWORK STRUCTURE ---
{framework_text}"""

    messages = [{"role": "system", "content": system_content}]
    # Include last 10 messages of conversation history
    for msg in conversation_history[-10:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": message})

    logger.info("Studio chat: model=%s, %d amendments in context, %d history msgs",
                model, len(amendments), len(conversation_history))

    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    result = json.loads(response.choices[0].message.content)
    num_edits = len(result.get("amendments", []))
    logger.info("Studio chat result: %d amendments proposed", num_edits)
    return result


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_amendments(raw_response: dict, dimension_number: int) -> list[dict]:
    """Validate and normalize amendments from an AI response.

    Ensures uniform schema. Drops malformed entries with a warning.
    """
    raw_amendments = raw_response.get("amendments", [])
    valid = []
    for i, a in enumerate(raw_amendments):
        atype = a.get("type")
        if atype not in AMENDMENT_TYPES:
            logger.warning("Dim %d amendment %d: invalid type '%s', dropping", dimension_number, i, atype)
            continue

        if not a.get("rationale"):
            a["rationale"] = "No rationale provided"

        # Ensure dimension_number is set
        a["dimension_number"] = a.get("dimension_number", dimension_number)

        # Component/criterion-level ops need component_code
        if atype in ("add_criterion", "remove_criterion", "edit_criterion",
                      "remove_component", "edit_description"):
            if not a.get("component_code"):
                logger.warning("Dim %d amendment %d: %s missing component_code, dropping",
                               dimension_number, i, atype)
                continue

        # Add operations need content
        if atype in ("add_component", "add_criterion", "add_dimension") and not a.get("content"):
            logger.warning("Dim %d amendment %d: %s missing content, dropping",
                           dimension_number, i, atype)
            continue

        # add_component content needs name and criteria
        if atype == "add_component":
            content = a.get("content", {})
            if not content.get("name") or not content.get("criteria"):
                logger.warning("Dim %d amendment %d: add_component missing name/criteria, dropping",
                               dimension_number, i)
                continue

        # add_criterion content needs text and criterion_type
        if atype == "add_criterion":
            content = a.get("content", {})
            if not content.get("text") or not content.get("criterion_type"):
                logger.warning("Dim %d amendment %d: add_criterion missing text/type, dropping",
                               dimension_number, i)
                continue

        valid.append(a)

    return valid


# ---------------------------------------------------------------------------
# Step 3: Apply Amendments (pure code)
# ---------------------------------------------------------------------------

def apply_amendments(sqf_tree: list[dict], amendments: list[dict]) -> list[dict]:
    """Apply a list of amendments to a copy of the SQF tree.

    Returns the modified tree in OnboardingDimension[] format.
    Does not mutate the input.
    """
    tree = copy.deepcopy(sqf_tree)

    # Index dimensions by number for fast lookup
    dim_by_number = {}
    for dim in tree:
        num = dim.get("number")
        if isinstance(num, str):
            try:
                num = int(num)
            except ValueError:
                pass
        dim_by_number[num] = dim

    for a in amendments:
        atype = a["type"]
        dim_num = a.get("dimension_number")

        if atype == "remove_dimension":
            tree = [d for d in tree if d.get("number") != dim_num]
            dim_by_number.pop(dim_num, None)
            continue

        if atype == "add_dimension":
            content = a.get("content", {})
            new_dim = {
                "number": content.get("number", str(len(tree) + 1)),
                "name": content.get("name", "Custom Dimension"),
                "description": content.get("description", ""),
                "color": DIMENSION_COLORS[len(tree) % len(DIMENSION_COLORS)],
                "is_custom": True,
                "components": content.get("components", []),
            }
            # Ensure components and criteria in custom dims have is_custom set
            for comp in new_dim["components"]:
                comp.setdefault("is_custom", True)
                for crit in comp.get("criteria", []):
                    crit.setdefault("is_custom", True)
            tree.append(new_dim)
            dim_by_number[new_dim["number"]] = new_dim
            continue

        # All other ops target a specific dimension
        dim = dim_by_number.get(dim_num)
        if not dim:
            logger.warning("Amendment targets dimension %s which doesn't exist, skipping", dim_num)
            continue

        comp_code = a.get("component_code")

        if atype == "add_component":
            content = a.get("content", {})
            new_comp = {
                "code": content.get("code", f"{dim_num}Z"),
                "name": content.get("name", "New Component"),
                "description": content.get("description", ""),
                "is_custom": content.get("is_custom", True),
                "criteria": content.get("criteria", []),
            }
            dim.setdefault("components", []).append(new_comp)
            continue

        if atype == "remove_component":
            dim["components"] = [c for c in dim.get("components", []) if c.get("code") != comp_code]
            continue

        # Find the target component
        comp = next((c for c in dim.get("components", []) if c.get("code") == comp_code), None)
        if not comp:
            logger.warning("Amendment targets component %s which doesn't exist in dim %s, skipping",
                           comp_code, dim_num)
            continue

        if atype == "edit_description":
            content = a.get("content", {})
            if "description" in content:
                comp["description"] = content["description"]
            continue

        if atype == "add_criterion":
            content = a.get("content", {})
            new_crit = {
                "criterion_type": content.get("criterion_type", "core_action"),
                "text": content.get("text", ""),
                "is_custom": True,
            }
            comp.setdefault("criteria", []).append(new_crit)
            continue

        if atype == "remove_criterion":
            idx = a.get("criterion_index")
            criteria = comp.get("criteria", [])
            if idx is not None and 0 <= idx < len(criteria):
                criteria.pop(idx)
            continue

        if atype == "edit_criterion":
            idx = a.get("criterion_index")
            content = a.get("content", {})
            criteria = comp.get("criteria", [])
            if idx is not None and 0 <= idx < len(criteria):
                if "text" in content:
                    criteria[idx]["text"] = content["text"]
                if "criterion_type" in content:
                    criteria[idx]["criterion_type"] = content["criterion_type"]
            continue

    return tree


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_school_context(school_profile: dict, learned: dict) -> str:
    """Format school profile and learned data for AI prompts."""
    parts = [
        f"School: {school_profile.get('name', 'Unknown')}",
        f"Type: {school_profile.get('school_type', 'Unknown')}",
        f"Grades: {school_profile.get('grade_levels', 'Unknown')}",
        f"Enrollment: {school_profile.get('enrollment', 'Unknown')}",
        f"Location: {school_profile.get('district', '')} {school_profile.get('state', '')}".strip(),
    ]
    if learned.get("identity"):
        parts.append(f"\nIdentity: {learned['identity']}")
    if learned.get("programs"):
        parts.append(f"Programs: {', '.join(learned['programs'])}")
    if learned.get("priorities"):
        parts.append(f"Priorities: {', '.join(learned['priorities'])}")
    if learned.get("challenges"):
        parts.append(f"Challenges: {', '.join(learned['challenges'])}")
    if learned.get("custom_needs"):
        parts.append(f"Custom framework needs: {', '.join(learned['custom_needs'])}")
    if learned.get("skip_candidates"):
        parts.append(f"Components to consider removing: {', '.join(learned['skip_candidates'])}")
    return "\n".join(parts)


def _format_dimension_for_prompt(dimension_data: dict) -> str:
    """Format one dimension's full SQF content for the amendment prompt."""
    lines = [
        f"Dimension {dimension_data['number']}: {dimension_data['name']}",
        f"Description: {dimension_data.get('description', '')}",
        "",
    ]
    for comp in dimension_data.get("components", []):
        lines.append(f"  Component {comp['code']}: {comp['name']}")
        lines.append(f"  Description: {comp.get('description', '')}")
        lines.append("  Criteria:")
        for i, crit in enumerate(comp.get("criteria", [])):
            ctype = crit.get("criterion_type", crit.get("type", ""))
            text = crit.get("text", "")
            lines.append(f"    [{i}] ({ctype}) {text}")
        lines.append("")
    return "\n".join(lines)
