import pytest
from pydantic import ValidationError

from app.tool_arguments import CreateTaskArguments, ListTasksArguments, UpdateTaskArguments


def test_tool_arguments_reject_unknown_fields():
    with pytest.raises(ValidationError):
        CreateTaskArguments.model_validate({"title": "Review", "user_id": 1})


@pytest.mark.parametrize("limit", [0, 101, True])
def test_list_task_arguments_bound_limits_and_require_integer(limit):
    with pytest.raises(ValidationError):
        ListTasksArguments.model_validate({"limit": limit})


@pytest.mark.parametrize("task_id", [0, -1, True, "4"])
def test_update_task_arguments_require_positive_integer_id(task_id):
    with pytest.raises(ValidationError):
        UpdateTaskArguments.model_validate({"task_id": task_id})


def test_create_task_arguments_validate_fields_and_dates():
    arguments = CreateTaskArguments.model_validate(
        {"title": "Review", "priority": "high", "due_date": "2026-11-01T10:00:00Z"}
    )

    assert arguments.priority == "high"
    assert arguments.due_date is not None
