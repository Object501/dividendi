"""Validate the versioned structural contract for public JSON data."""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

PUBLIC_DATA_SCHEMA_PATH = (
    Path(__file__).resolve().parents[2] / "schema" / "public-data-v1.schema.json"
)


@cache
def _public_schema() -> dict[str, object]:
    with PUBLIC_DATA_SCHEMA_PATH.open(encoding="utf-8") as source:
        schema: dict[str, object] = json.load(source)
    Draft202012Validator.check_schema(schema)
    return schema


@cache
def _validator(definition: str) -> Draft202012Validator:
    schema = _public_schema()
    selected_schema = {
        "$schema": schema["$schema"],
        "$defs": schema["$defs"],
        "$ref": f"#/$defs/{definition}",
    }
    return Draft202012Validator(selected_schema, format_checker=FormatChecker())


def _validate(value: object, definition: str, document_name: str) -> None:
    errors = sorted(
        _validator(definition).iter_errors(value),
        key=lambda error: tuple(str(part) for part in error.absolute_path),
    )
    if not errors:
        return

    error = errors[0]
    location = ".".join(str(part) for part in error.absolute_path)
    path = document_name if not location else f"{document_name}.{location}"
    raise ValueError(f"{path} 不符合 public-data-v1 JSON Schema: {error.message}")


def validate_latest_schema(value: object) -> None:
    """Validate one structural EOD snapshot inside history.json."""

    _validate(value, "latestDocument", "latest")


def validate_history_schema(value: object) -> None:
    """Validate the structural history.json v1 contract."""

    _validate(value, "historyDocument", "history")
