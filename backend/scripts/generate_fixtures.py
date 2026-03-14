"""Generate AI assessment fixtures by calling the real OpenAI-powered agents.

Run from the backend directory:
    source .venv/bin/activate
    python scripts/generate_fixtures.py

Requires OPENAI_API_KEY in .env (or environment). Costs ~$2 and takes ~2-3 minutes.
Outputs: app/fixtures/ai_assessments.json
"""

import asyncio
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

# Ensure app modules are importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.ai.agents.component_agent import assess_component
from app.ai.agents.dimension_agent import synthesize_dimension
from app.ai.agents.global_agent import generate_global_summary
from app.seed import EVIDENCE_DATA, SQF_FRAMEWORK

SCHOOL_NAME = "Lincoln Innovation Academy"
STAGE = "diagnostic"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "app" / "fixtures" / "ai_assessments.json"


def build_evidence_map() -> dict[str, list[dict]]:
    """Map component codes to their evidence items (as dicts for the AI agents)."""
    comp_evidence: dict[str, list[dict]] = defaultdict(list)
    for fname, etype, _uploader, summary, findings, comp_codes in EVIDENCE_DATA:
        item = {
            "filename": fname,
            "evidence_type": etype.value if hasattr(etype, "value") else str(etype),
            "summary": summary,
            "key_findings": findings,
        }
        for code in comp_codes:
            comp_evidence[code].append(item)
    return dict(comp_evidence)


def build_component_lookup() -> dict[str, dict]:
    """Build a lookup of component code -> {name, dimension_name, core_actions, progress_indicators}."""
    lookup = {}
    for dim in SQF_FRAMEWORK:
        for comp in dim["components"]:
            core_actions = [c[1] for c in comp["criteria"] if c[0] == "core_action"]
            progress_indicators = [c[1] for c in comp["criteria"] if c[0] == "progress_indicator"]
            lookup[comp["code"]] = {
                "name": comp["name"],
                "dimension_name": dim["name"],
                "dimension_number": dim["number"],
                "core_actions": core_actions,
                "progress_indicators": progress_indicators,
            }
    return lookup


async def run():
    evidence_map = build_evidence_map()
    comp_lookup = build_component_lookup()

    # Identify which components have evidence
    scored_codes = sorted(evidence_map.keys(), key=lambda c: (int(c[:-1]), c[-1]))
    print(f"\n{'='*60}")
    print(f"Generating AI assessments for {len(scored_codes)} components")
    print(f"Components: {', '.join(scored_codes)}")
    print(f"{'='*60}\n")

    # --- Layer 2: Component assessments ---
    component_scores = {}
    for i, code in enumerate(scored_codes, 1):
        info = comp_lookup[code]
        evidence_items = evidence_map[code]
        print(f"[{i}/{len(scored_codes)}] Assessing {code}: {info['name']} ({len(evidence_items)} evidence items)...", end=" ", flush=True)
        try:
            result = await assess_component(
                component_code=code,
                component_name=info["name"],
                dimension_name=info["dimension_name"],
                core_actions=info["core_actions"],
                progress_indicators=info["progress_indicators"],
                evidence_items=evidence_items,
            )
            component_scores[code] = result
            print(f"-> {result.get('rating', '?')} (confidence: {result.get('confidence', '?')})")
        except Exception as e:
            print(f"FAILED: {e}")
            component_scores[code] = {"error": str(e)}

    # --- Layer 3: Dimension syntheses ---
    print(f"\n{'='*60}")
    print("Synthesizing dimensions...")
    print(f"{'='*60}\n")

    dimension_summaries = {}
    for dim in SQF_FRAMEWORK:
        dim_name = dim["name"]
        # Gather scored components for this dimension
        dim_scores = []
        for comp in dim["components"]:
            code = comp["code"]
            if code in component_scores and "error" not in component_scores[code]:
                score = component_scores[code]
                dim_scores.append({
                    "code": code,
                    "name": comp["name"],
                    "rating": score.get("rating", "not_rated"),
                    "confidence": score.get("confidence", "unknown"),
                    "strengths": score.get("strengths", []),
                    "gaps": score.get("gaps", []),
                    "rationale": score.get("rationale", ""),
                })

        if not dim_scores:
            print(f"  [{dim['number']}] {dim_name}: SKIPPED (no scored components)")
            continue

        print(f"  [{dim['number']}] {dim_name} ({len(dim_scores)} components)...", end=" ", flush=True)
        try:
            result = await synthesize_dimension(
                dimension_name=dim_name,
                component_scores=dim_scores,
            )
            dimension_summaries[dim_name] = result
            print("OK")
        except Exception as e:
            print(f"FAILED: {e}")
            dimension_summaries[dim_name] = {"error": str(e)}

    # --- Layer 4: Global summary ---
    print(f"\n{'='*60}")
    print("Generating global summary...")
    print(f"{'='*60}\n")

    dim_data_for_global = []
    for dim in SQF_FRAMEWORK:
        dim_name = dim["name"]
        if dim_name in dimension_summaries and "error" not in dimension_summaries[dim_name]:
            ds = dimension_summaries[dim_name]
            dim_data_for_global.append({
                "name": dim_name,
                "overall_assessment": ds.get("overall_assessment", ""),
                "patterns": ds.get("patterns", []),
                "top_opportunities": ds.get("top_opportunities", []),
                "compounding_risks": ds.get("compounding_risks", []),
            })

    try:
        global_summary = await generate_global_summary(
            school_name=SCHOOL_NAME,
            stage=STAGE,
            dimension_summaries=dim_data_for_global,
        )
        print("  Global summary: OK")
    except Exception as e:
        print(f"  Global summary: FAILED: {e}")
        global_summary = {"error": str(e)}

    # --- Write fixtures ---
    fixtures = {
        "generated_at": datetime.utcnow().isoformat(),
        "school_name": SCHOOL_NAME,
        "component_scores": component_scores,
        "dimension_summaries": dimension_summaries,
        "global_summary": global_summary,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(fixtures, f, indent=2, ensure_ascii=False)
    print(f"\nFixtures written to {OUTPUT_PATH}")

    # --- Quality report ---
    print(f"\n{'='*60}")
    print("QUALITY REPORT")
    print(f"{'='*60}")

    # Rating distribution
    ratings = defaultdict(int)
    confidences = defaultdict(int)
    rationale_lengths = []
    evidence_counts = []
    for code, score in component_scores.items():
        if "error" in score:
            continue
        ratings[score.get("rating", "unknown")] += 1
        confidences[score.get("confidence", "unknown")] += 1
        rationale = score.get("rationale", "")
        rationale_lengths.append(len(rationale))
        evidence_counts.append(score.get("evidence_count", 0))

    print(f"\nComponent scores: {len([s for s in component_scores.values() if 'error' not in s])}/{len(component_scores)}")
    print("\nRating distribution:")
    for rating, count in sorted(ratings.items()):
        print(f"  {rating}: {count}")
    print("\nConfidence distribution:")
    for conf, count in sorted(confidences.items()):
        print(f"  {conf}: {count}")
    if rationale_lengths:
        print(f"\nRationale length (chars): min={min(rationale_lengths)}, avg={sum(rationale_lengths)//len(rationale_lengths)}, max={max(rationale_lengths)}")

    # Dimension summaries
    ok_dims = len([d for d in dimension_summaries.values() if "error" not in d])
    print(f"\nDimension summaries: {ok_dims}/{len(dimension_summaries)}")

    # Global summary
    if "error" not in global_summary:
        print(f"Global summary: OK (exec summary length: {len(global_summary.get('executive_summary', ''))} chars)")
    else:
        print("Global summary: FAILED")

    print(f"\n{'='*60}")
    print("Done!")


if __name__ == "__main__":
    asyncio.run(run())
