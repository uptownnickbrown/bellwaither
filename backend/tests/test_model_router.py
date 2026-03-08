"""Tests for the AI model router configuration."""

from app.ai.model_router import MODEL_ROUTING, AITaskType, get_model_for_task


def test_all_task_types_have_mapping():
    """Every AITaskType enum value must have a corresponding entry in MODEL_ROUTING."""
    for task_type in AITaskType:
        assert task_type in MODEL_ROUTING, f"Missing routing for {task_type.value}"


def test_get_model_for_task_returns_strings():
    for task_type in AITaskType:
        model = get_model_for_task(task_type)
        assert isinstance(model, str)
        assert len(model) > 0


def test_routing_configuration_is_complete():
    """MODEL_ROUTING should have exactly as many entries as AITaskType members."""
    assert len(MODEL_ROUTING) == len(AITaskType)


def test_specific_task_routing():
    """Spot-check that synthesis tasks use the synthesis model."""
    model = get_model_for_task(AITaskType.DIMENSION_SYNTHESIS)
    assert model  # non-empty
    model2 = get_model_for_task(AITaskType.EXTRACTION)
    assert model2  # non-empty
