"""
Model Router: Routes AI requests to the appropriate model based on task type.
Designed for future eval-based routing and A/B testing.
"""
import logging
from enum import Enum

from app.config import settings

logger = logging.getLogger(__name__)


class AITaskType(str, Enum):
    # Layer 1: Artifact-level
    EXTRACTION = "extraction"           # Extract text, summarize, tag
    STRUCTURED_DATA = "structured_data" # Parse tables, metrics from spreadsheets

    # Layer 2: Component-level
    COMPONENT_ASSESSMENT = "component_assessment"  # Rate a component, find gaps
    EVIDENCE_MAPPING = "evidence_mapping"           # Map evidence to components

    # Layer 3: Dimension-level
    DIMENSION_SYNTHESIS = "dimension_synthesis"     # Cross-component patterns

    # Layer 4: Global
    GLOBAL_ORCHESTRATION = "global_orchestration"  # Executive summary, priorities
    ACTION_PLANNING = "action_planning"            # Generate action plan items

    # Cross-cutting
    COPILOT_CHAT = "copilot_chat"        # Interactive Q&A
    FOLLOW_UP_GENERATION = "follow_up"   # Generate follow-up data requests
    REPORT_COMPOSITION = "report"        # Compose formatted reports

    # Onboarding
    ONBOARDING_INTERVIEW = "onboarding_interview"  # Framework customization interview
    ONBOARDING_AMENDMENT_PLAN = "onboarding_amendment_plan"  # Step 0: dimension plan
    ONBOARDING_AMENDMENT_DIMENSION = "onboarding_amendment_dim"  # Step 1: per-dimension amendments
    ONBOARDING_AMENDMENT_COHERENCE = "onboarding_amendment_coh"  # Step 2: coherence pass


# Model routing table - maps task types to models
# This is the abstraction layer for future eval-based routing
MODEL_ROUTING: dict[AITaskType, str] = {
    AITaskType.EXTRACTION: settings.model_extraction,
    AITaskType.STRUCTURED_DATA: settings.model_extraction,
    AITaskType.COMPONENT_ASSESSMENT: settings.model_synthesis,
    AITaskType.EVIDENCE_MAPPING: settings.model_extraction,
    AITaskType.DIMENSION_SYNTHESIS: settings.model_synthesis,
    AITaskType.GLOBAL_ORCHESTRATION: settings.model_synthesis,
    AITaskType.ACTION_PLANNING: settings.model_composition,
    AITaskType.COPILOT_CHAT: settings.model_retrieval,
    AITaskType.FOLLOW_UP_GENERATION: settings.model_extraction,
    AITaskType.REPORT_COMPOSITION: settings.model_composition,
    AITaskType.ONBOARDING_INTERVIEW: settings.model_synthesis,
    AITaskType.ONBOARDING_AMENDMENT_PLAN: settings.model_extraction,
    AITaskType.ONBOARDING_AMENDMENT_DIMENSION: settings.model_extraction,
    AITaskType.ONBOARDING_AMENDMENT_COHERENCE: settings.model_synthesis,
}


def get_model_for_task(task_type: AITaskType) -> str:
    """Get the appropriate model for a given task type."""
    model = MODEL_ROUTING.get(task_type, settings.model_extraction)
    logger.debug("Routed task %s -> model %s", task_type.value, model)
    return model
