# Visual QA Rubric — 10 Dimensions × 10 Points (Ship Threshold ≥ 75)

> Adapted from daymade/ppt-creator RUBRIC.md + PPTAgent PPTEval Content/Design/Coherence dimensions. Anchored examples for each score level so LLM-as-judge variance is bounded.

---

## 1. Goal Clarity (10 pts)

Does the deck have a single, clear conclusion the audience can summarize in one sentence?

| Score | Anchor |
|---|---|
| 10 | One sentence summarizes the entire deck's argument; every slide supports it |
| 8 | Clear primary message; minor digressions |
| 5 | Multiple competing messages; audience would summarize differently |
| 2 | No discernible main message; reads as info dump |
| 0 | Contradictory messages within the deck |

---

## 2. Story Structure (10 pts)

Pyramid Principle: 1 conclusion → 3-5 supporting reasons → evidence per reason.

| Score | Anchor |
|---|---|
| 10 | Cover + TOC + 3-5 sections with consistent depth + Conclusion + Call-to-action |
| 8 | All key structural slides present; minor depth inconsistency |
| 5 | Missing TOC OR conclusion; structure inferable |
| 2 | Random slide order; no narrative arc |
| 0 | Critical structural slides missing (no cover, no closing) |

---

## 3. Slide Assertions (10 pts)

Headings are testable assertion sentences, not topic labels.

| Score | Anchor |
|---|---|
| 10 | Every content slide headline is a complete assertion ("Why X fails", "What Y means for Z") |
| 8 | Most assertions; 1-2 topic labels OK |
| 5 | Half assertions, half topic labels |
| 2 | All topic labels ("Marketing Strategy", "Q3 Results") |
| 0 | Generic placeholder headings ("Slide 5", "Content") |

---

## 4. Evidence Quality (10 pts)

Bullets are concrete and result-oriented, not abstract.

| Score | Anchor |
|---|---|
| 10 | Every bullet has a number, name, time period, or specific noun |
| 8 | Most bullets specific; 1-2 abstract |
| 5 | Half specific, half abstract / generic |
| 2 | Mostly abstract ("We are pursuing growth opportunities") |
| 0 | Lorem ipsum / placeholder / vacuous |

---

## 5. Chart Fit (10 pts)

Charts match data shape (per VIS-GUIDE chart selection dictionary). Axis labeled. Source cited.

| Score | Anchor |
|---|---|
| 10 | Chart type matches data; axes labeled with units; source in footer; legend clear |
| 8 | Minor labeling gap |
| 5 | Wrong chart type for data shape (e.g. pie for time series) |
| 2 | Chart with no axes / no units / no source |
| 0 | Misleading chart (Y-axis not starting at 0 when comparing magnitudes) |

---

## 6. Visual & Accessibility (10 pts)

WCAG AA contrast + no overlap + visual element per slide + clean typography.

| Score | Anchor |
|---|---|
| 10 | All contrast ≥ 4.5:1 body / 3:1 large; no overlap; every content slide has visual; consistent margins |
| 8 | 1 minor contrast issue OR 1 minor margin drift |
| 5 | ≥ 2 contrast issues OR overlap on 1+ slide |
| 2 | Text-only content slides OR severe contrast failures |
| 0 | Unreadable text / overlapping critical content |

---

## 7. Coherence & Transitions (10 pts)

Consecutive slides share visual vocabulary. layoutArchetype varies appropriately. spec_lock values are honored verbatim.

| Score | Anchor |
|---|---|
| 10 | Every slide uses spec_lock palette + fonts; layout variance feels intentional; transitions narrate logical flow |
| 8 | 1 minor drift (e.g. 1 slide used a non-spec_lock accent) |
| 5 | Multiple drift instances OR layout monotony (3+ same-archetype consecutive) |
| 2 | Major drift across half the deck OR no archetype variance |
| 0 | Random visual styles per slide (looks like different decks merged) |

---

## 8. Speakability (10 pts)

Each speaker note can be read aloud in 45-60 seconds AND matches what the slide shows.

| Score | Anchor |
|---|---|
| 10 | Every note 100-300 chars (CN) / 150-250 words (EN); structured (opening/assertion/evidence/transition); references same data as slide |
| 8 | Minor length variance OR 1-2 notes too generic |
| 5 | Half the notes don't reference slide content specifically |
| 2 | Notes shorter than 50 chars OR longer than 500 chars |
| 0 | Notes missing on multiple content slides |

---

## 9. Deliverables Complete (10 pts)

All expected output artifacts produced.

| Score | Anchor |
|---|---|
| 10 | .pptx + spec_lock.json + speaker notes + per-page QA scores + session log |
| 8 | Missing 1 secondary artifact |
| 5 | Missing speaker notes OR missing QA scores |
| 2 | .pptx only |
| 0 | .pptx fails `unzip -t` integrity check |

---

## 10. Robustness (10 pts)

Gaps marked, fallbacks explicit. No silent failures.

| Score | Anchor |
|---|---|
| 10 | Every missing input field surfaced in intake; every fallback documented in speaker notes; failed retries reported with diagnosis |
| 8 | Minor undocumented assumption |
| 5 | Silent placeholder fallback (anti-pattern from IntelliFlow current pipeline) |
| 2 | Multiple silent fallbacks |
| 0 | Critical failures hidden from user |

---

## Scoring Process

1. Subagent receives PNG of each slide + spec_lock.json + speaker notes JSON.
2. Subagent scores each of 10 dimensions for the DECK as a whole (not per-slide).
3. Total = sum of 10 scores (max 100).
4. **Threshold to ship: ≥ 75**.

If < 75:
1. Identify weakest 3 dimensions.
2. For each, propose specific fix (which slide(s), what action).
3. Regenerate affected slides.
4. Re-render → re-score.
5. **Max 2 iterations**. If still failing after iteration 2, surface to user with screenshots + dimension scores + cannot-fix diagnosis.

---

## How to invoke (subagent prompt template)

```
You are a visual QA scorer for a slide deck.

Inputs:
1. Per-slide rendered PNGs (image inputs in this message)
2. spec_lock.json (attached as text)
3. PageBrief + speaker notes (attached as JSON)

For each of the 10 dimensions, score 0-10 with anchored examples
from this rubric (references/rubric.md).

For dimensions scoring < 7, list specific slides + specific issues.

Output format:
{
  "scores": {
    "goal_clarity": 8,
    "story_structure": 9,
    ...
  },
  "total": 78,
  "passed": true,
  "weakest_3": ["coherence_and_transitions", "robustness", "evidence_quality"],
  "fixes": [
    { "slide": "p3", "action": "regenerate", "reason": "color #2D9966 not in spec_lock palette; layoutArchetype same as p2" },
    ...
  ]
}

Be honest. If the deck is barely passing, flag it. Visual QA's job
is to find problems, not declare success.
```

---

## Citation

- daymade/claude-code-skills/ppt-creator references/RUBRIC.md (10 dimensions, threshold concept, iteration cap)
- icip-cas/PPTAgent paper (Content / Design / Coherence three-axis, anchored rubric)
- impeccable/critique skill (double-blind, ruthless prioritization, never-generic-questions)
