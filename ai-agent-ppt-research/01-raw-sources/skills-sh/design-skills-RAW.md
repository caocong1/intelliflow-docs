# Skills.sh Design/Polish Skills — Raw Source Capture

Date captured: 2026-05-20
Purpose: Research source for visual quality improvements to IntelliFlow PPT generation pipeline.

Fetch notes:
- Most `https://www.skills.sh/...` pages truncate SKILL.md content behind "Show more".
- GitHub raw URLs (`raw.githubusercontent.com`) work for actual SKILL.md when the directory layout is known.
- Impeccable skills live under `pbakaus/impeccable/skill/reference/*.md` (not top-level dirs).
- Taste-skill maps via `skill.sh` registry: `design-taste-frontend` = `skills/taste-skill/SKILL.md`; `high-end-visual-design` = `skills/soft-skill/SKILL.md`.
- Anthropic skills retrieved through GitHub blob view rendering.
- `anthropics/skills/canvas-design` was the most expansive content captured.

---

## 1. anthropics/skills/frontend-design

Source: https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md

```markdown
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:

* Purpose: What problem does this interface solve? Who uses it?
* Tone: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc.
* Constraints: Technical requirements (framework, performance, accessibility).
* Differentiation: What makes this UNFORGETTABLE?

CRITICAL: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code that is:
* Production-grade and functional
* Visually striking and memorable
* Cohesive with a clear aesthetic point-of-view
* Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:

* Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices. Pair a distinctive display font with a refined body font.
* Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
* Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.
* Spatial Composition: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
* Backgrounds & Visual Details: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics: overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

IMPORTANT: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.
```

---

## 2. anthropics/skills/canvas-design

Source: https://github.com/anthropics/skills/blob/main/skills/canvas-design/SKILL.md

```markdown
name: canvas-design
description: Create beautiful visual art in .png and .pdf documents using design philosophy. You should use this skill when the user asks to create a poster, piece of art, design, or other static piece. Create original visual designs, never copying existing artists' work to avoid copyright violations.

These are instructions for creating design philosophies - aesthetic movements that are then EXPRESSED VISUALLY. Output only .md files, .pdf files, and .png files.

Complete this in two steps:
1. Design Philosophy Creation (.md file)
2. Express by creating it on a canvas (.pdf file or .png file)

## DESIGN PHILOSOPHY CREATION

Create a VISUAL PHILOSOPHY (not layouts or templates) that will be interpreted through:
* Form, space, color, composition
* Images, graphics, shapes, patterns
* Minimal text as visual accent

### THE CRITICAL UNDERSTANDING
* What is received: Some subtle input or instructions by the user that should be taken into account, but used as a foundation; it should not constrain creative freedom.
* What is created: A design philosophy/aesthetic movement.
* What happens next: Then, the same version receives the philosophy and EXPRESSES IT VISUALLY - creating artifacts that are 90% visual design, 10% essential text.

Consider this approach:
* Write a manifesto for an art movement
* The next phase involves making the artwork

The philosophy must emphasize: Visual expression. Spatial communication. Artistic interpretation. Minimal words.

### HOW TO GENERATE A VISUAL PHILOSOPHY

Name the movement (1-2 words): "Brutalist Joy" / "Chromatic Silence" / "Metabolist Dreams"

Articulate the philosophy (4-6 paragraphs - concise but complete):
To capture the VISUAL essence, express how the philosophy manifests through:
* Space and form
* Color and material
* Scale and rhythm
* Composition and balance
* Visual hierarchy

CRITICAL GUIDELINES:
* Avoid redundancy: Each design aspect should be mentioned once.
* Emphasize craftsmanship REPEATEDLY: The philosophy MUST stress multiple times that the final work should appear as though it took countless hours to create, was labored over with care, and comes from someone at the absolute top of their field. Repeat phrases like "meticulously crafted," "the product of deep expertise," "painstaking attention," "master-level execution."
* Leave creative space: Remain specific about the aesthetic direction, but concise enough that the next Claude has room to make interpretive choices.

The philosophy must guide the next version to express ideas VISUALLY, not through text. Information lives in design, not paragraphs.

### PHILOSOPHY EXAMPLES

"Concrete Poetry" Philosophy: Communication through monumental form and bold geometry. Visual expression: Massive color blocks, sculptural typography (huge single words, tiny labels), Brutalist spatial divisions, Polish poster energy meets Le Corbusier. Ideas expressed through visual weight and spatial tension, not explanation. Text as rare, powerful gesture - never paragraphs, only essential words integrated into the visual architecture.

"Chromatic Language" Philosophy: Color as the primary information system. Visual expression: Geometric precision where color zones create meaning. Typography minimal - small sans-serif labels letting chromatic fields communicate. Think Josef Albers' interaction meets data visualization.

"Analog Meditation" Philosophy: Quiet visual contemplation through texture and breathing room. Visual expression: Paper grain, ink bleeds, vast negative space. Photography and illustration dominate. Typography whispered. Japanese photobook aesthetic.

"Organic Systems" Philosophy: Natural clustering and modular growth patterns. Visual expression: Rounded forms, organic arrangements, color from nature through architecture.

"Geometric Silence" Philosophy: Pure order and restraint. Visual expression: Grid-based precision, bold photography or stark graphics, dramatic negative space. Swiss formalism meets Brutalist material honesty.

### ESSENTIAL PRINCIPLES
* VISUAL PHILOSOPHY: Create an aesthetic worldview to be expressed through design
* MINIMAL TEXT: Always emphasize that text is sparse, essential-only, integrated as visual element
* SPATIAL EXPRESSION: Ideas communicate through space, form, color, composition
* ARTISTIC FREEDOM: The next Claude interprets the philosophy visually
* PURE DESIGN: About making ART OBJECTS, not documents with decoration
* EXPERT CRAFTSMANSHIP: Repeatedly emphasize the final work must look meticulously crafted

## DEDUCING THE SUBTLE REFERENCE

Before creating the canvas, identify the subtle conceptual thread from the original request.

THE ESSENTIAL PRINCIPLE: The topic is a subtle, niche reference embedded within the art itself - not always literal, always sophisticated. Someone familiar with the subject should feel it intuitively. The design philosophy provides the aesthetic language. The deduced topic provides the soul.

## CANVAS CREATION

Create one single page, highly visual, design-forward PDF or PNG output (unless asked for more pages). Generally use repeating patterns and perfect shapes. Treat the abstract philosophical design as if it were a scientific bible, borrowing the visual language of systematic observation—dense accumulation of marks, repeated elements, or layered patterns that build meaning through patient repetition and reward sustained viewing. Add sparse, clinical typography and systematic reference markers.

Text as a contextual element: Text is always minimal and visual-first. Most of the time, font should be thin. All use of fonts must be design-forward and prioritize visual communication. Regardless of text scale, nothing falls off the page and nothing overlaps. Every element must be contained within the canvas boundaries with proper margins.

IMPORTANT: Use different fonts if writing text. Search the `./canvas-fonts` directory.

CRITICAL: To achieve human-crafted quality (not AI-generated), create work that looks like it took countless hours. Make it appear as though someone at the absolute top of their field labored over every detail with painstaking care.

## FINAL STEP

The user ALREADY said "It isn't perfect enough. It must be pristine, a masterpiece if craftsmanship, as if it were about to be displayed in a museum."

CRITICAL: To refine the work, avoid adding more graphics; instead refine what has been created and make it extremely crisp. If the instinct is to call a new function or draw a new shape, STOP and instead ask: "How can I make what's already here more of a piece of art?"

## MULTI-PAGE OPTION

When requested, create more creative pages along the same lines as the design philosophy but distinctly different as well. Treat the first page as just a single page in a whole coffee table book. Make the next pages unique twists and memories of the original. Have them almost tell a story in a very tasteful way.
```

---

## 3. pbakaus/impeccable/polish

Source: https://raw.githubusercontent.com/pbakaus/impeccable/main/skill/reference/polish.md

Polish: a final-quality pass that catches alignment, spacing, consistency, and interaction details before shipping. Anchored in this rule: "polish without alignment is decoration on top of drift." Refinement must follow functional completion and align with existing design system tokens.

Key phases:
- Design System Discovery: identify existing patterns, conventions, components before any polish work. Categorize deviations by root cause: missing tokens, unused shared components, or conceptual misalignment with neighboring features.
- Pre-Polish Assessment: experience-first thinking. "Effective design beats decorative polish; a feature that looks beautiful but fights the user's flow is not polished."

Polish dimensions covered methodically:
- Visual alignment and spacing consistency
- Information architecture matching adjacent features
- Typography hierarchy and readability
- Color contrast and token usage
- Comprehensive interaction states (default, hover, focus, active, disabled, loading, error, success)
- Micro-interactions respecting `prefers-reduced-motion`
- Content consistency and copy quality
- Forms with proper validation and accessibility
- Edge cases and error handling
- Responsive behavior across devices
- Code cleanliness

Critical guardrails: do not polish incomplete work, do not guess system principles without asking, do not introduce new patterns that diverge from established ones. Quality must remain consistent across features rather than perfecting isolated corners.

---

## 4. pbakaus/impeccable/critique

Source: https://raw.githubusercontent.com/pbakaus/impeccable/main/skill/reference/critique.md

Critique runs two independent assessments on a single design target, synthesizes findings, persists results, prompts user for next priorities.

Orchestration rules:
- Assessment Independence: Design review (Assessment A) completes first without seeing detector output (Assessment B). Both must finish before synthesis.
- Target Resolution: "The homepage" becomes a concrete file path (e.g., `site/pages/index.astro`) or URL. Paths preferred over dev-server URLs because ports drift.
- Browser Automation: each assessment gets its own fresh browser tab.

Assessment A — Design Review:
- AI slop detection (does it scream AI-generated?)
- Nielsen's 10 heuristics (scored 0–4 each)
- Cognitive load against a checklist
- Emotional journey through peak-end rule
- Persona red flags
- Returns 2–3 strengths, 3–5 priority issues, provocative questions

Assessment B — Detector + Browser Evidence:
- Run `detect.mjs` on markup files (CLI scan) or use browser visualization for URLs.
- Overlay injection requires a live server.

Synthesis & Reporting:
- Weave both assessments together. Note agreement, what detector caught that LLM missed, false positives.
- Present full structured critique in chat (not summary + link).
- Include: Nielsen heuristics table, anti-patterns verdict, overall impression, priority issues with P0–P3 severity, persona red flags, provocative questions.

Persistence & Engagement:
- Write report snapshot to `.impeccable/critique/` with metadata and trend line (last 5 run scores).
- Then ask 2–4 targeted questions grounded in actual findings — never generic audience questions.
- Offer 2–3 concrete options per question.

Hard constraints:
- Both assessments mandatory.
- "Do not claim a user-visible overlay exists unless script injection succeeded and the detector ran in the page."
- "If everything is important, nothing is" — ruthless prioritization required.
- Feedback must be direct, specific, actionable.

---

## 5. pbakaus/impeccable/bolder

Source: https://raw.githubusercontent.com/pbakaus/impeccable/main/skill/reference/bolder.md

Amplify safe / generic designs with intentional drama, distinctive choices, and visual confidence while maintaining usability.

Definition: "bolder" means "distinctive. Extreme scale, unexpected color, typographic risk, committed POV."

Warning on common AI pitfalls: "When asked for 'bolder,' AI defaults to the same tired tricks: cyan/purple gradients, glassmorphism, neon accents on dark backgrounds." These are NOT bolder.

Six weakness sources in safe designs:
1. generic choices
2. timid scale
3. low contrast
4. static presentation
5. predictability
6. flat hierarchy

Amplification strategies:
- Typography: swap generic fonts for distinctive selections; create extreme size jumps (3x–5x differences); pair extreme weights together.
- Color: increase saturation; use one bold color dominating 60% of design; avoid standard gradients.
- Space: use 100–200px gaps instead of standard 20–40px; break grids intentionally; layer elements asymmetrically.
- Effects: dramatic shadows and textures; explicitly reject glassmorphism (it's overused AI slop).
- Composition: clear focal points; unexpected proportions like 70/30 splits rather than balanced layouts.

Safeguards: bold must remain functional and coherent. "Bold means distinctive, not 'more effects.'" Avoid adding effects randomly, sacrificing readability, overwhelming with motion, or copying trends blindly. The ultimate test: would showing the result prompt immediate recognition of AI authorship? If yes, the design failed.

---

## 6. pbakaus/impeccable/distill

Source: https://raw.githubusercontent.com/pbakaus/impeccable/main/skill/reference/distill.md

Strip designs to their core by removing everything that doesn't serve the user's primary goal.

Core philosophy: "Simplicity is not about removing features. It's about removing obstacles between users and their goals."

Six simplification dimensions:

Information Architecture: reduce scope, implement progressive disclosure, consolidate actions, eliminate redundancy. Establish one clear primary action with minimal secondary options.

Visual Simplification: restrict color palettes to 1–2 colors plus neutrals; limit typography to one font family with 3–4 sizes; remove decorative elements; eliminate unnecessary cards that don't serve functional purposes.

Layout Simplification: favor linear vertical flows over complex grids; remove sidebars by moving content inline; use full-width layouts generously; maintain consistent alignment with abundant white space.

Interaction Simplification: reduce decision points; establish smart defaults; prioritize inline actions over modals; minimize steps required.

Content Simplification: brevity, active voice, plain language, scannable structure, ruthless elimination of redundant explanations.

Code Simplification: remove unused code, flatten component hierarchies, consolidate styles, limit component variations.

Safeguards: do not remove necessary functionality, sacrifice accessibility, create confusing designs through over-minimalism, or eliminate information users need for decision-making. Complexity should match actual task complexity.

---

## 7. vercel-labs/agent-skills/web-design-guidelines

Source: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md (this is what the SKILL.md fetches dynamically).

```markdown
# Web Interface Guidelines

Review these files for compliance: $ARGUMENTS

Read files, check against rules below. Output concise but comprehensive—sacrifice grammar for brevity. High signal-to-noise.

## Rules

### Accessibility
- Icon-only buttons need `aria-label`
- Form controls need `<label>` or `aria-label`
- Interactive elements need keyboard handlers (`onKeyDown`/`onKeyUp`)
- `<button>` for actions, `<a>`/`<Link>` for navigation (not `<div onClick>`)
- Images need `alt` (or `alt=""` if decorative)
- Decorative icons need `aria-hidden="true"`
- Async updates (toasts, validation) need `aria-live="polite"`
- Use semantic HTML before ARIA
- Headings hierarchical `<h1>`–`<h6>`; include skip link for main content
- `scroll-margin-top` on heading anchors

### Focus States
- Interactive elements need visible focus: `focus-visible:ring-*` or equivalent
- Never `outline-none` / `outline: none` without focus replacement
- Use `:focus-visible` over `:focus`
- Group focus with `:focus-within` for compound controls

### Forms
- Inputs need `autocomplete` and meaningful `name`
- Use correct `type` and `inputmode`
- Never block paste (`onPaste` + `preventDefault`)
- Labels clickable (`htmlFor` or wrapping control)
- Disable spellcheck on emails, codes, usernames
- Submit button stays enabled until request starts; spinner during request
- Errors inline next to fields; focus first error on submit
- Placeholders end with `…` and show example pattern
- Warn before navigation with unsaved changes

### Animation
- Honor `prefers-reduced-motion`
- Animate `transform`/`opacity` only (compositor-friendly)
- Never `transition: all`—list properties explicitly
- Set correct `transform-origin`
- SVG: transforms on `<g>` wrapper with `transform-box: fill-box; transform-origin: center`
- Animations interruptible—respond to user input mid-animation

### Typography
- `…` not `...`
- Curly quotes `"` `"` not straight `"`
- Non-breaking spaces: `10&nbsp;MB`, `⌘&nbsp;K`, brand names
- Loading states end with `…`: `"Loading…"`, `"Saving…"`
- `font-variant-numeric: tabular-nums` for number columns/comparisons
- Use `text-wrap: balance` or `text-pretty` on headings (prevents widows)

### Content Handling
- Text containers handle long content: `truncate`, `line-clamp-*`, or `break-words`
- Flex children need `min-w-0` to allow text truncation
- Handle empty states—don't render broken UI for empty strings/arrays
- User-generated content: anticipate short, average, and very long inputs

### Images
- `<img>` needs explicit `width` and `height` (prevents CLS)
- Below-fold images: `loading="lazy"`
- Above-fold critical images: `priority` or `fetchpriority="high"`

### Performance
- Large lists (>50 items): virtualize
- No layout reads in render
- Batch DOM reads/writes; avoid interleaving
- Prefer uncontrolled inputs
- Add `<link rel="preconnect">` for CDN/asset domains
- Critical fonts: `<link rel="preload" as="font">` with `font-display: swap`

### Navigation & State
- URL reflects state—filters, tabs, pagination, expanded panels in query params
- Links use `<a>`/`<Link>` (Cmd/Ctrl+click, middle-click support)
- Deep-link all stateful UI
- Destructive actions need confirmation modal or undo window—never immediate

### Touch & Interaction
- `touch-action: manipulation`
- `-webkit-tap-highlight-color` set intentionally
- `overscroll-behavior: contain` in modals/drawers/sheets
- During drag: disable text selection, `inert` on dragged elements
- `autoFocus` sparingly—desktop only, single primary input; avoid on mobile

### Safe Areas & Layout
- Full-bleed layouts need `env(safe-area-inset-*)` for notches
- Avoid unwanted scrollbars: `overflow-x-hidden` on containers
- Flex/grid over JS measurement for layout

### Dark Mode & Theming
- `color-scheme: dark` on `<html>` for dark themes (fixes scrollbar, inputs)
- `<meta name="theme-color">` matches page background
- Native `<select>`: explicit `background-color` and `color`

### Locale & i18n
- Dates/times: use `Intl.DateTimeFormat`
- Numbers/currency: use `Intl.NumberFormat`
- Detect language via `Accept-Language` / `navigator.languages`, not IP
- Brand names, code tokens, identifiers: wrap with `translate="no"`

### Hydration Safety
- Inputs with `value` need `onChange` (or use `defaultValue` for uncontrolled)
- Date/time rendering: guard against hydration mismatch
- `suppressHydrationWarning` only where truly needed

### Hover & Interactive States
- Buttons/links need `hover:` state (visual feedback)
- Interactive states increase contrast

### Content & Copy
- Active voice: "Install the CLI" not "The CLI will be installed"
- Title Case for headings/buttons (Chicago style)
- Numerals for counts: "8 deployments" not "eight"
- Specific button labels: "Save API Key" not "Continue"
- Error messages include fix/next step
- Second person; avoid first person
- `&` over "and" where space-constrained

### Anti-patterns (flag these)
- `user-scalable=no` or `maximum-scale=1` disabling zoom
- `onPaste` with `preventDefault`
- `transition: all`
- `outline-none` without focus-visible replacement
- Inline `onClick` navigation without `<a>`
- `<div>` or `<span>` with click handlers
- Images without dimensions
- Large arrays `.map()` without virtualization
- Form inputs without labels
- Icon buttons without `aria-label`
- Hardcoded date/number formats
- `autoFocus` without clear justification

## Output Format

Group by file. Use `file:line` format (VS Code clickable). Terse findings.

State issue + location. Skip explanation unless fix non-obvious. No preamble.
```

---

## 8. leonxlnx/taste-skill/design-taste-frontend

Source: https://raw.githubusercontent.com/leonxlnx/taste-skill/main/skills/taste-skill/SKILL.md

```markdown
---
name: design-taste-frontend
description: Senior UI/UX Engineer. Architect digital interfaces overriding default LLM biases. Enforces metric-based rules, strict component architecture, CSS hardware acceleration, and balanced design engineering.
---

# High-Agency Frontend Skill

## 1. ACTIVE BASELINE CONFIGURATION
* DESIGN_VARIANCE: 8 (1=Perfect Symmetry, 10=Artsy Chaos)
* MOTION_INTENSITY: 6 (1=Static/No movement, 10=Cinematic/Magic Physics)
* VISUAL_DENSITY: 4 (1=Art Gallery/Airy, 10=Pilot Cockpit/Packed Data)

Standard baseline for all generations is strictly set to (8, 6, 4). Adapt these values dynamically based on user requests. Use these as global variables to drive logic in Sections 3 through 7.

## 2. DEFAULT ARCHITECTURE & CONVENTIONS

* DEPENDENCY VERIFICATION: Before importing any 3rd party library, check `package.json`. Output install command if missing.
* RSC SAFETY: Global state works only in Client Components. Wrap providers in `"use client"`.
* INTERACTIVITY ISOLATION: If Motion/Liquid Glass active, extract as isolated leaf component with `'use client'` at top.
* TAILWIND VERSION LOCK: Check `package.json` first. Do not use v4 syntax in v3 projects.
* ANTI-EMOJI POLICY: NEVER use emojis. Replace with Radix/Phosphor icons.
* Viewport Stability: Use `min-h-[100dvh]` not `h-screen`.
* Grid over Flex-Math: Use CSS Grid for reliable structures.
* Icons: `@phosphor-icons/react` or `@radix-ui/react-icons` only. Standardize `strokeWidth` (1.5 or 2.0).

## 3. DESIGN ENGINEERING DIRECTIVES

Rule 1: Deterministic Typography
* Display/Headlines: `text-4xl md:text-6xl tracking-tighter leading-none`
* ANTI-SLOP: Discourage `Inter`. Use `Geist`, `Outfit`, `Cabinet Grotesk`, or `Satoshi`.
* TECHNICAL UI RULE: Serif BANNED for Dashboard/Software UI.
* Body/Paragraphs: `text-base text-gray-600 leading-relaxed max-w-[65ch]`

Rule 2: Color Calibration
* Max 1 Accent Color. Saturation < 80%.
* THE LILA BAN: "AI Purple/Blue" aesthetic is BANNED. No purple button glows, no neon gradients.
* COLOR CONSISTENCY: Stick to one palette. Do not fluctuate between warm and cool grays.

Rule 3: Layout Diversification
* ANTI-CENTER BIAS: Centered Hero/H1 sections BANNED when LAYOUT_VARIANCE > 4.
* Force "Split Screen" (50/50), "Left Aligned content/Right Aligned asset", "Asymmetric White-space".

Rule 4: Materiality, Shadows, and Anti-Card Overuse
* DASHBOARD HARDENING: For VISUAL_DENSITY > 7, generic card containers BANNED. Use `border-t`, `divide-y`, or negative space.
* Cards ONLY when elevation communicates hierarchy. Tint shadows to background hue.

Rule 5: Interactive UI States — Mandatory loading/empty/error/tactile feedback.

Rule 6: Data & Form Patterns — Label above input. Helper text optional. Error below input.

## 4. CREATIVE PROACTIVITY (Anti-Slop)
* Liquid Glass: 1px inner border + inset highlight shadow.
* Magnetic Micro-physics: Use Framer Motion's `useMotionValue`/`useTransform`, never React state.
* Perpetual Micro-Interactions: Pulse/Typewriter/Float/Shimmer. Spring physics (`type: "spring", stiffness: 100, damping: 20`).
* Layout Transitions: Use `layout` and `layoutId` for smooth re-ordering.
* Staggered Orchestration: Use `staggerChildren` or CSS cascade `animation-delay: calc(var(--index) * 100ms)`.

## 5. PERFORMANCE GUARDRAILS
* Grain/noise filters: exclusively fixed `pointer-events-none` pseudo-elements.
* Animate exclusively `transform` and `opacity`.
* Z-Index Restraint: systemic layers only.

## 6. TECHNICAL REFERENCE (Dials)
DESIGN_VARIANCE: 1-3 Predictable, 4-7 Offset, 8-10 Asymmetric.
MOTION_INTENSITY: 1-3 Static, 4-7 Fluid CSS, 8-10 Advanced Choreography.
VISUAL_DENSITY: 1-3 Art Gallery, 4-7 Daily App, 8-10 Cockpit (monospace numbers mandatory).

## 7. AI TELLS (Forbidden Patterns)
Visual: NO neon glows, NO pure black, NO oversaturated accents, NO gradient text, NO custom cursors.
Typography: NO Inter, NO oversized H1s, serif only for editorial.
Layout: NO 3-column card row, perfect padding/margins.
Content: NO "John Doe", NO generic avatars, NO `99.99%` numbers, NO "Acme/Nexus", NO "Elevate/Seamless".
External: NO broken Unsplash links, use `picsum.photos/seed/{key}/800/600`.

## 8. THE CREATIVE ARSENAL
Dozens of advanced patterns: Magnetic Button, Gooey Menu, Dynamic Island, Bento Grid, Masonry, Chroma Grid, Parallax Tilt, Spotlight Border, Sticky Scroll Stack, Horizontal Scroll Hijack, Kinetic Marquee, Text Mask Reveal, Mesh Gradient Background, etc.

## 9. THE MOTION-ENGINE BENTO PARADIGM
Palette: `#f9fafb` background, white cards with `border-slate-200/50`.
Surfaces: `rounded-[2.5rem]`, diffusion shadow `shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]`.
Typography: Geist/Satoshi/Cabinet Grotesk, `tracking-tight` headers.
Labels: outside and below cards (gallery style).
Padding: `p-8` or `p-10`.
Spring physics. Layout transitions. Infinite loops in active state. Memoize and isolate all perpetual motion.

Five Card Archetypes:
1. Intelligent List (auto-sort with `layoutId`)
2. Command Input (typewriter)
3. Live Status (breathing indicator)
4. Wide Data Stream (infinite carousel)
5. Contextual UI (staggered highlight + float-in toolbar)

## 10. FINAL PRE-FLIGHT CHECK
- Global state appropriately used
- Mobile collapse guaranteed
- `min-h-[100dvh]` used
- `useEffect` cleanup present
- Empty/loading/error states implemented
- Cards omitted where spacing suffices
- Perpetual animations isolated in Client Components
```

---

## 9. leonxlnx/taste-skill/high-end-visual-design (= soft-skill)

Source: https://raw.githubusercontent.com/leonxlnx/taste-skill/main/skills/soft-skill/SKILL.md

```markdown
# Agent Skill: Principal UI/UX Architect & Motion Choreographer (Awwwards-Tier)

## 1. Meta Information & Core Directive
- Persona: `Vanguard_UI_Architect`
- Objective: Engineer $150k+ agency-level digital experiences. Output must exude haptic depth, cinematic spatial rhythm, obsessive micro-interactions, and flawless fluid motion.
- The Variance Mandate: NEVER generate the same layout or aesthetic twice in a row.

## 2. THE "ABSOLUTE ZERO" DIRECTIVE (STRICT ANTI-PATTERNS)
Instant failure if generated code includes:
- Banned Fonts: Inter, Roboto, Arial, Open Sans, Helvetica. Use `Geist`, `Clash Display`, `PP Editorial New`, `Plus Jakarta Sans`.
- Banned Icons: Standard thick-stroked Lucide, FontAwesome, Material. Use Phosphor Light, Remix Line.
- Banned Borders & Shadows: Generic 1px solid gray borders. Harsh dark shadows (`shadow-md`, `rgba(0,0,0,0.3)`).
- Banned Layouts: Edge-to-edge sticky top navbars. Symmetrical Bootstrap 3-column grids without whitespace.
- Banned Motion: Standard `linear` or `ease-in-out`. Instant state changes.

## 3. THE CREATIVE VARIANCE ENGINE

A. Vibe & Texture Archetypes (Pick 1):
1. Ethereal Glass (SaaS/AI/Tech): OLED black `#050505`, radial mesh gradients (subtle glowing purple/emerald orbs), Vantablack cards with `backdrop-blur-2xl` and white/10 hairlines. Wide geometric Grotesk typography.
2. Editorial Luxury (Lifestyle/Real Estate/Agency): Warm creams `#FDFBF7`, muted sage, deep espresso. Variable Serif fonts for massive headings. Noise/film-grain overlay (`opacity-[0.03]`).
3. Soft Structuralism (Consumer/Health/Portfolio): Silver-grey or white backgrounds. Massive bold Grotesk. Airy floating components with diffused ambient shadows.

B. Layout Archetypes (Pick 1):
1. Asymmetrical Bento: masonry CSS Grid with varying card sizes. Mobile collapse to single column.
2. Z-Axis Cascade: overlapping cards with `-2deg`/`3deg` rotations. Mobile removes rotations.
3. Editorial Split: massive typography on `w-1/2`, interactive content on right. Mobile stacks.

Mobile Override: asymmetric layouts above `md:` must collapse to `w-full`, `px-4`, `py-8` below 768px. Never `h-screen`; always `min-h-[100dvh]`.

## 4. HAPTIC MICRO-AESTHETICS

A. The "Double-Bezel" (Doppelrand / Nested Architecture)
Never place a card flat on the background. Use nested enclosures:
- Outer Shell: wrapper div with subtle background (`bg-black/5` or `bg-white/5`), hairline outer border (`ring-1 ring-black/5`), padding `p-1.5` or `p-2`, large radius `rounded-[2rem]`.
- Inner Core: distinct background, inner highlight (`shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]`), mathematically calculated smaller radius `rounded-[calc(2rem-0.375rem)]` for concentric curves.

B. Nested CTA & "Island" Button
- Fully rounded pills (`rounded-full`) with generous padding (`px-6 py-3`).
- Button-in-Button Trailing Icon: if arrow `↗`, nest in own circular wrapper `w-8 h-8 rounded-full bg-black/5 dark:bg-white/10`.

C. Spatial Rhythm
- Macro-Whitespace: Double standard padding. Use `py-24` to `py-40` for sections.
- Eyebrow Tags: Microscopic pill badge before H1/H2 (`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium`).

## 5. MOTION CHOREOGRAPHY
All motion must simulate real-world mass and spring physics. Use custom cubic-beziers (e.g., `transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]`).

A. Fluid Island Nav & Hamburger Reveal — floating glass pill detached from top (`mt-6 mx-auto w-max rounded-full`). Hamburger morphs to X via `rotate-45`. Modal expansion overlay. Staggered mask reveal (`translate-y-12 opacity-0` → `translate-y-0 opacity-100`, `delay-100`, `delay-150`).

B. Magnetic Button Hover Physics — `active:scale-[0.98]`, inner icon translates `group-hover:translate-x-1 group-hover:-translate-y-[1px]`.

C. Scroll Interpolation — `translate-y-16 blur-md opacity-0` → `translate-y-0 blur-0 opacity-100` over 800ms+. Use IntersectionObserver / `whileInView`, never scroll event listener.

## 6. PERFORMANCE GUARDRAILS
- Animate only `transform` and `opacity`.
- `backdrop-blur` only on fixed/sticky elements.
- Grain overlays on fixed `pointer-events-none` pseudo-elements.
- No arbitrary `z-50`; systemic layers only.

## 7. EXECUTION PROTOCOL
1. [SILENT THOUGHT] Roll Variance Engine. Choose Vibe + Layout archetypes.
2. [SCAFFOLD] Background texture, macro-whitespace, massive typography.
3. [ARCHITECT] DOM with Double-Bezel technique. Exaggerated squircles `rounded-[2rem]`.
4. [CHOREOGRAPH] Custom cubic-beziers, staggered nav reveals, button-in-button hover.
5. [OUTPUT] Pixel-perfect React/Tailwind.

## 8. PRE-OUTPUT CHECKLIST
- No banned items from Section 2
- Vibe + Layout archetype consciously selected
- Double-Bezel on all major cards
- Button-in-Button trailing icon
- `py-24` minimum section padding
- Custom cubic-bezier on all transitions
- Scroll entry animations present
- Mobile single-column collapse < 768px
- Only `transform`/`opacity` animated
- `backdrop-blur` on fixed/sticky only
- Reads as "$150k agency build", not "template with nice fonts"
```

Additional source: gpt-tasteskill SKILL.md — a parallel system enforcing AIDA structure, 2-line iron rule for hero (`max-w-5xl`+ containers), Python RNG seeded randomization of layout/font/components, gapless Bento (`grid-flow-dense`), banned meta-labels ("SECTION 01"), `picsum.photos/seed/{kw}/1920/1080` image strategy with CSS filters (grayscale, mix-blend-luminosity), and mandatory `<design_plan>` pre-flight block.

Additional context from `pbakaus/impeccable/DESIGN.md` — case study of how a project applies these rules. Editorial Sanctuary aesthetic: warm-paper neutrals + single magenta accent ≤10% of screen, italic Cormorant Garamond display + Instrument Sans body at 1.6 leading, OKLCH-only color tokens, flat-by-default surfaces (shadows are state response), spacing scale 8/16/24/32/48/80/120 (skip 4px step), expo-out easing `cubic-bezier(0.16, 1, 0.3, 1)`, hard bans on side-stripe borders, gradient text, glassmorphism, dark-mode-by-default, identical card grids, hero-metric template.

Additional impeccable reference dimensions: typography.md (modular scale 1.25/1.333/1.5, OpenType `font-variant-numeric: tabular-nums`, `text-wrap: balance`), color-and-contrast.md (OKLCH-not-HSL, tinted neutrals 0.005-0.015 chroma toward brand hue, 60-30-10 visual weight rule, tinted shadows for dark mode), spatial-design.md ("Space is the most underused design tool. Find the layout's actual problem—monotone spacing, weak hierarchy, identical card grids, the centered-stack default—and fix the structure, not the surface.").
