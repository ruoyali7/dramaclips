"""Optional LLM reranking for already-generated hook candidates.

The model is deliberately kept out of media processing: it can only score and
explain candidates. The worker remains the source of truth for timestamps,
rendering, and QA.
"""

import json
import os
from typing import Any

import requests

RANKING_SCHEMA = {
    "type": "object",
    "properties": {
        "rankings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "score": {"type": "number", "minimum": 0, "maximum": 1},
                    "keep": {"type": "boolean"},
                    "reason": {"type": "string"},
                },
                "required": ["id", "score", "keep", "reason"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["rankings"],
    "additionalProperties": False,
}


def _extract_json(response: dict[str, Any]) -> dict[str, Any]:
    for item in response.get("output", []):
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"}:
                value = content.get("text", "").strip()
                if value:
                    return json.loads(value)
    raise ValueError("AI reranker returned no JSON output")


def _request(candidates: list[dict[str, Any]], direction: str) -> list[dict[str, Any]]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    model = os.getenv("HOOK_AI_MODEL", "gpt-5-mini")
    payload = {
        "model": model,
        "store": False,
        "max_output_tokens": 1200,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "hook_candidate_rankings",
                "strict": True,
                "schema": RANKING_SCHEMA,
            },
        },
        "input": [
            {
                "role": "system",
                "content": [{
                    "type": "input_text",
                    "text": (
                        "You rank short-drama hook candidates. Judge story clarity, "
                        "conflict, emotional escalation, and whether the ending creates "
                        "an honest open loop. Return exactly one judgment for every "
                        "candidate ID. Duration is automatic with a hard maximum of 90 "
                        "seconds: prefer a shorter version only when it preserves the "
                        "complete setup, escalation, and open loop. Do not invent facts "
                        "outside the transcript."
                    ),
                }],
            },
            {
                "role": "user",
                "content": [{
                    "type": "input_text",
                    "text": json.dumps(
                        {"creativeDirection": direction, "candidates": candidates},
                        ensure_ascii=False,
                    ),
                }],
            },
        ],
    }
    response = requests.post(
        "https://api.openai.com/v1/responses",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=float(os.getenv("HOOK_AI_TIMEOUT_SECONDS", "45")),
    )
    response.raise_for_status()
    return _extract_json(response.json()).get("rankings", [])


def _validated_rankings(
    rankings: list[dict[str, Any]], candidate_ids: list[str]
) -> dict[str, dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for item in rankings:
        identifier = str(item.get("id", ""))
        if identifier in by_id or identifier not in candidate_ids:
            raise ValueError("AI reranker returned duplicate or unknown candidate IDs")
        score = float(item["score"])
        if not 0 <= score <= 1 or not isinstance(item.get("keep"), bool):
            raise ValueError("AI reranker returned invalid score or keep value")
        by_id[identifier] = {**item, "score": score}
    if set(by_id) != set(candidate_ids):
        raise ValueError("AI reranker did not judge every candidate")
    return by_id


def rerank(candidates: list[dict[str, Any]], direction: str) -> list[dict[str, Any]]:
    """Return candidates sorted by the optional model, with safe fallback."""
    if not candidates or os.getenv("HOOK_AI_RERANKER_ENABLED", "false").lower() != "true":
        return candidates
    try:
        rankings = _request(
            [{
                "id": item["id"],
                "episode": item["sourceRanges"][0]["episodeNumber"],
                "start": item["sourceRanges"][0]["start"],
                "end": item["sourceRanges"][0]["end"],
                "durationSeconds": round(item["sourceRanges"][0]["end"]-item["sourceRanges"][0]["start"],3),
                "transcript": item.get("transcript", ""),
                "ruleScore": item.get("score", 0),
            } for item in candidates],
            direction,
        )
        by_id = _validated_rankings(rankings, [item["id"] for item in candidates])
        enriched = []
        for index, item in enumerate(candidates):
            judgment = by_id[item["id"]]
            score = judgment["score"]
            item["scoreComponents"]["aiRerank"] = round(score * 100, 2)
            item["scoreComponents"]["aiKeep"] = 100 if judgment["keep"] else 0
            reason = str(judgment["reason"]).strip()[:300]
            item["rationale"] = f"{item['rationale']} AI: {reason}"
            enriched.append((judgment["keep"], score, -index, item))
        return [item for _, _, _, item in sorted(enriched, reverse=True)]
    except (KeyError, TypeError, ValueError, requests.RequestException, RuntimeError) as error:
        print(f"AI reranker unavailable; keeping rule ranking: {error}")
        return candidates
