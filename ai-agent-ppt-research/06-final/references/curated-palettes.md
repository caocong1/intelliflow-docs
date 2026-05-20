# Curated Palettes + Font Pairings (Layer 0 fallback)

> Sourced from anthropics/skills/pptx and AionUi morph-ppt-3d (two independent projects converged on identical lists). When the brief is ambiguous or LLM color inference is uncertain, **fall back to one of these verbatim**.

---

## 10 Curated Palettes

Pick ONE per deck. Mix-and-match across decks is OK, but within a deck stay disciplined.

| # | Theme | Primary | Secondary | Accent | Body Text | Muted | Best For |
|---|---|---|---|---|---|---|---|
| 1 | **Midnight Executive** | `#1E2761` navy | `#CADCFC` ice blue | `#FFFFFF` | `#333333` | `#8899BB` | Finance, executive briefings, formal corporate |
| 2 | **Forest & Moss** | `#2C5F2D` forest | `#97BC62` moss | `#F5F5F5` cream | `#2D2D2D` | `#6B8E6B` | Sustainability, healthcare, education |
| 3 | **Coral Energy** | `#F96167` coral | `#F9E795` gold | `#2F3C7E` navy | `#333333` | `#8B7E6A` | Product launch, marketing, consumer |
| 4 | **Warm Terracotta** | `#B85042` terracotta | `#E7E8D1` sand | `#A7BEAE` sage | `#3D2B2B` | `#8C7B75` | Architecture, lifestyle, hospitality |
| 5 | **Ocean Gradient** | `#065A82` deep blue | `#1C7293` teal | `#21295C` navy | `#2B3A4E` | `#6B8FAA` | Tech / data, science, research |
| 6 | **Charcoal Minimal** | `#36454F` charcoal | `#F2F2F2` off-white | `#212121` | `#333333` | `#7A8A94` | Editorial, photography, minimalist |
| 7 | **Teal Trust** | `#028090` teal | `#00A896` seafoam | `#02C39A` mint | `#2D3B3B` | `#5E8C8C` | Healthcare, wellness, finance |
| 8 | **Berry & Cream** | `#6D2E46` berry | `#A26769` dusty rose | `#ECE2D0` cream | `#3D2233` | `#8C6B7A` | Brand, fashion, food/beverage |
| 9 | **Sage Calm** | `#84B59F` sage | `#69A297` eucalyptus | `#50808E` | `#2D3D35` | `#7A9488` | Wellness, education, slow brands |
| 10 | **Cherry Bold** | `#990011` cherry | `#FCF6F5` off-white | `#2F3C7E` navy | `#333333` | `#8B6B6B` | Bold marketing, pitch decks, keynotes |

### Dominance Rule

> "One color should dominate (60-70% visual weight), with 1-2 supporting tones and one sharp accent. Never give all colors equal weight." (anthropics/pptx)

This is the **60-30-10** rule:
- 60-70% — Primary (background-adjacent, large fills, headlines)
- 20-30% — Secondary (cards, body backgrounds, body text on light)
- 10-15% — Accent (callouts, emphasis, eyebrow tags, decorative)

### Specificity Test

> "If swapping your colors into a completely different presentation would still 'work,' you haven't made specific enough choices." (anthropics/pptx)

A palette is good when it **commits** to a deck's character. Generic blue/gray works "anywhere" → ban.

---

## 8 Font Pairings

Pick ONE per deck. **Every stack must end with a Windows-preinstalled fallback**.

| # | Header (Display) | Body | Best For | Full stack example |
|---|---|---|---|---|
| 1 | **Georgia** | Calibri | Formal business, finance | `Georgia, Source Han Serif SC, Cambria, serif` / `Calibri, Microsoft YaHei, sans-serif` |
| 2 | **Arial Black** | Arial | Bold marketing, product launches | `Arial Black, "Microsoft YaHei", Impact, sans-serif` / `Arial, "Microsoft YaHei", sans-serif` |
| 3 | **Calibri** | Calibri Light | Clean corporate, minimal | `Calibri, "Microsoft YaHei", sans-serif` / `"Calibri Light", "Microsoft YaHei Light", sans-serif` |
| 4 | **Cambria** | Calibri | Traditional professional | `Cambria, "Source Han Serif SC", serif` / `Calibri, "Microsoft YaHei", sans-serif` |
| 5 | **Trebuchet MS** | Calibri | Friendly tech, startups | `"Trebuchet MS", "Microsoft YaHei", sans-serif` / same body |
| 6 | **Impact** | Arial | Bold headlines, keynotes | `Impact, "Microsoft YaHei", Charcoal, sans-serif` / `Arial, "Microsoft YaHei", sans-serif` |
| 7 | **Palatino** | Garamond | Elegant editorial, luxury | `Palatino, "Source Han Serif SC", serif` / `Garamond, "Source Han Serif SC", serif` |
| 8 | **Consolas** | Calibri | Developer tools, technical | `Consolas, Menlo, monospace` / `Calibri, "Microsoft YaHei", sans-serif` |

### CJK Pairing (Chinese deck)

For Chinese decks, swap the Latin display font with a CJK serif/sans:

| Header (CJK display) | Body (CJK) | Best for |
|---|---|---|
| `Source Han Serif SC / "思源宋体 CN"` | `Source Han Sans SC / "PingFang SC"` | Formal serif Chinese |
| `"PingFang SC" bold` | `"PingFang SC"` | Clean modern Chinese |
| `"思源黑体 CN" / "Noto Sans CJK SC"` | same | Pan-Asian decks |

Always pair with Microsoft YaHei fallback for Windows compatibility:
- Header: `"Source Han Serif SC", "PingFang SC", "Microsoft YaHei", serif`
- Body: `"PingFang SC", "Microsoft YaHei", -apple-system, sans-serif`

---

## Size Hierarchy

| Element | Min | Typical | Max |
|---|---|---|---|
| Display title (cover) | 56pt | 60-72pt | 96pt |
| Page title | 36pt | 36-44pt | 50pt |
| Section header | 20pt | 20-24pt | 28pt |
| Body | **16pt** (hard floor) | 18-22pt | 28pt |
| Caption / footnote | 10pt | 10-14pt | 14pt |
| Mono / eyebrow | 12pt | 14pt | 16pt |

**Title must be ≥ 2× body** (anthropics + AionUi). If "36 over 20pt works, 28 over 20pt looks timid."

---

## Selection Decision Tree

```
Has user supplied a brief tone?
  └── tone="formal" + colorMode="dark" → Midnight Executive
  └── tone="natural" + audience="public" → Forest & Moss / Sage Calm
  └── tone="energetic" + audience="consumer" → Coral Energy / Cherry Bold
  └── tone="warm" + style="lifestyle" → Warm Terracotta / Berry & Cream
  └── tone="tech" + audience="executive" → Ocean Gradient / Charcoal Minimal
  └── tone="trust" + industry="health" → Teal Trust
  └── unclear → Charcoal Minimal (safest editorial)

Has user supplied a Chinese topic?
  └── ALWAYS pair with CJK font stack (see CJK Pairing above)

Is deck for high-density data?
  └── add monospace numeric layer (Consolas / Menlo) for stat callouts

Is deck for executive/board?
  └── prefer Cambria / Georgia headers (serif gravitas)
  └── prefer Charcoal Minimal / Midnight Executive palettes
```

---

## Anti-Patterns (cross-ref NEVER-list)

- DO NOT default to corporate blue if no other guidance → use Charcoal Minimal instead.
- DO NOT use 3+ palettes within one deck.
- DO NOT use 3+ font families within one deck (1 family + 4 sizes is the impeccable/distill rule).
- DO NOT use system-default fonts (Helvetica / Lucida) — pick from the table above.

---

## How Layer 0 should use this file

```
Layer 0 prompt template (excerpt):

## Color decision
If the visual brief gives clear hex colors or a clear theme name,
derive primary/secondary/accents from that.
If the brief is ambiguous (e.g. just "modern green editorial"),
SELECT one of the 10 curated palettes verbatim from
references/curated-palettes.md. Do not invent intermediate hex
values. Output `source.kind: "preset"` and `source.presetId:
"forest_and_moss"`.

## Font decision
SELECT one of the 8 font pairings from references/curated-palettes.md.
Ensure the resulting stack ends with a Windows-preinstalled font.
For Chinese decks, ALWAYS lead with a CJK font and end with Microsoft YaHei.
```
