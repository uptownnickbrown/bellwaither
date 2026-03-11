"""Cross-cutting: AI Copilot agent for interactive Q&A with tool-calling support."""

import json
import uuid
from datetime import datetime

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.model_router import AITaskType, get_model_for_task
from app.ai.prompts.system_prompts import COPILOT_SYSTEM_PROMPT
from app.config import settings
from app.models import Component, DataRequest
from app.models.data_request import RequestPriority, RequestStatus


# ---- OpenAI Tool Definitions ----

DATA_REQUEST_TOOL = {
    "type": "function",
    "function": {
        "name": "create_data_request",
        "description": (
            "Create a new data request to ask the school for specific documents, data, "
            "or information needed for the assessment. Use this when the user asks to "
            "create a data request, request information from the school, ask the school "
            "to send/provide/submit something, or wants to follow up on missing evidence."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "A short, clear title for the data request (e.g., 'Professional Development Logs for 2024-2025')",
                },
                "description": {
                    "type": "string",
                    "description": (
                        "A detailed description of what is being requested, including specifics "
                        "about format, time period, or scope. This is what the school will see."
                    ),
                },
                "rationale": {
                    "type": "string",
                    "description": "Why this data/evidence is needed for the assessment.",
                },
                "priority": {
                    "type": "string",
                    "enum": ["high", "medium", "low"],
                    "description": "Priority level. Use 'high' for critical missing evidence, 'medium' for standard requests, 'low' for nice-to-have items.",
                },
                "assigned_to": {
                    "type": "string",
                    "description": "Name or role of the person responsible for fulfilling this request (e.g., 'Dr. Rivera', 'Principal', 'School Admin').",
                },
                "due_date": {
                    "type": "string",
                    "description": "Due date in YYYY-MM-DD format, if the user mentioned a deadline.",
                },
                "component_code": {
                    "type": "string",
                    "description": (
                        "The SQF component code this request relates to (e.g., '2.2' for Curriculum, "
                        "'4.4' for PD/Coaching). Only provide if a specific component is clearly relevant."
                    ),
                },
            },
            "required": ["title", "description"],
        },
    },
}

COPILOT_TOOLS = [DATA_REQUEST_TOOL]


# ---- Tool Execution ----

async def _execute_create_data_request(
    args: dict,
    engagement_id: uuid.UUID,
    user_role: str,
    db: AsyncSession,
) -> dict:
    """Execute the create_data_request tool call against the database."""

    # Resolve component_code to component_id if provided
    component_id = None
    component_code = args.get("component_code")
    if component_code:
        result = await db.execute(
            select(Component).where(Component.code == component_code)
        )
        comp = result.scalar_one_or_none()
        if comp:
            component_id = comp.id

    # Parse due_date if provided
    due_date = None
    if args.get("due_date"):
        try:
            due_date = datetime.strptime(args["due_date"], "%Y-%m-%d")
        except ValueError:
            pass  # Ignore invalid date formats

    # Map priority string to enum
    priority_str = args.get("priority", "medium").lower()
    try:
        priority = RequestPriority(priority_str)
    except ValueError:
        priority = RequestPriority.MEDIUM

    # Create the data request
    data_request = DataRequest(
        engagement_id=engagement_id,
        component_id=component_id,
        title=args["title"],
        description=args.get("description"),
        rationale=args.get("rationale"),
        priority=priority,
        assigned_to=args.get("assigned_to"),
        created_by=f"AI Copilot ({user_role})",
        status=RequestStatus.PENDING,
        due_date=due_date,
    )
    db.add(data_request)
    await db.commit()
    await db.refresh(data_request)

    return {
        "id": str(data_request.id),
        "title": data_request.title,
        "description": data_request.description,
        "rationale": data_request.rationale,
        "priority": data_request.priority.value,
        "status": data_request.status.value,
        "assigned_to": data_request.assigned_to,
        "due_date": data_request.due_date.isoformat() if data_request.due_date else None,
        "created_at": data_request.created_at.isoformat() if data_request.created_at else None,
        "component_code": component_code,
    }


TOOL_EXECUTORS = {
    "create_data_request": _execute_create_data_request,
}


# ---- Main Chat Function ----

async def copilot_chat(
    school_name: str,
    current_context: str,
    user_role: str,
    user_message: str,
    evidence_context: list[dict],
    conversation_history: list[dict],
    engagement_id: uuid.UUID | None = None,
    db: AsyncSession | None = None,
) -> dict:
    """Handle an interactive copilot chat message with tool-calling support."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = get_model_for_task(AITaskType.COPILOT_CHAT)

    system = COPILOT_SYSTEM_PROMPT.format(
        school_name=school_name,
        current_context=current_context,
        user_role=user_role,
    )

    # Augment system prompt with tool-calling guidance
    system += (
        "\n\nYou also have the ability to CREATE DATA REQUESTS on behalf of the user. "
        "When a user asks you to create a data request, request information from the school, "
        "ask the school to send/provide/submit documents or data, or wants to follow up on "
        "missing evidence, use the create_data_request tool. "
        "Extract as much detail as possible from their message (title, description, who to assign it to, "
        "priority, due date, related SQF component). If key details are ambiguous, make reasonable "
        "defaults (medium priority, descriptive title) but still create the request rather than "
        "asking too many clarifying questions. After creating a request, confirm what was created."
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

    # Determine whether to include tools (only if we have DB access)
    tools_enabled = db is not None and engagement_id is not None
    call_kwargs = {
        "model": model,
        "messages": messages,
        "temperature": 0.4,
    }
    if tools_enabled:
        call_kwargs["tools"] = COPILOT_TOOLS
        call_kwargs["tool_choice"] = "auto"

    response = await client.chat.completions.create(**call_kwargs)

    assistant_message = response.choices[0].message
    tool_results = []

    # Process tool calls if any
    if assistant_message.tool_calls and tools_enabled:
        # Add the assistant's response (with tool calls) to message history
        messages.append(assistant_message)

        for tool_call in assistant_message.tool_calls:
            fn_name = tool_call.function.name
            try:
                fn_args = json.loads(tool_call.function.arguments)
            except json.JSONDecodeError:
                fn_args = {}

            executor = TOOL_EXECUTORS.get(fn_name)
            if executor:
                try:
                    result = await executor(
                        args=fn_args,
                        engagement_id=engagement_id,
                        user_role=user_role,
                        db=db,
                    )
                    tool_results.append({
                        "tool": fn_name,
                        "status": "success",
                        "data": result,
                    })
                    # Feed success result back to the model
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(result),
                    })
                except Exception as e:
                    error_msg = f"Failed to create data request: {str(e)}"
                    tool_results.append({
                        "tool": fn_name,
                        "status": "error",
                        "error": error_msg,
                    })
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps({"error": error_msg}),
                    })
            else:
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps({"error": f"Unknown tool: {fn_name}"}),
                })

        # Get the final response after tool execution
        follow_up = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.4,
        )
        final_content = follow_up.choices[0].message.content
    else:
        final_content = assistant_message.content

    return {
        "content": final_content,
        "model_used": model,
        "tool_results": tool_results if tool_results else None,
    }
