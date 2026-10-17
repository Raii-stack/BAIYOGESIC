---
name: anti-ui-slop
description: "Use when creating new UI, expanding layouts, or iterating on frontend designs from selected Figma frames or references[cite: 1]. Triggers: UI generation, layout exploration, Figma to Code, creative direction, frontend styling, extending design systems, anti-slop."
metadata:
  author: design-system
  version: "1.0.0"
---

# Anti-UI Slop

## Core Principle: Study first. Form a thesis. Design second.
Do not begin by assembling components, using common landing-page patterns, or relying on generic "good-looking" AI defaults. The objective is to create work that feels authored, intentional, contemporary, and specific to the selected design DNA.

## Step 1 — Read the Selection
Inspect the complete selected design reference before generating anything.
*   **Analyze:** Page structure, information hierarchy, grid, columns, alignment, margins, typography (scale, line lengths), colors, image crops, components, borders, surfaces, icons, navigation, and negative space.
*   **Identify:** Rules shared across frames, recurring patterns, and layout exceptions that create character.
*   **Rule:** Never modify the selected reference frames. Use them strictly as source material.

## Step 2 — Extract the Design DNA
Internally summarize the Design DNA across these four pillars:
*   **Layout DNA:** Grid logic, content width, section proportions, spacing rhythm, symmetry vs. asymmetry, density, and intentional grid breaks.
*   **Typography DNA:** Display vs. body typography, hierarchy, line-height, tracking, label behavior, and editorial text treatments.
*   **Visual DNA:** Dominant visual language, palette behavior, materiality, borders, shadows, gradients, masks, and contrast.
*   **Composition DNA:** How the design creates focus, rhythm, tension, pacing, surprise, and section-to-section transitions. 

## Step 3 — Identify the Design Signature
Extract 5–10 specific signature behaviors from the selected design (e.g., oversized typography acting as architecture, asymmetric columns, unusually large negative space, editorial image crops). Never introduce a behavior that is not supported by the selected design.

## Step 4 — Find the Creative Tension
Determine what makes the selected design interesting:
*   Is it editorial or systematic? Restrained or expressive?
*   Where does the grid intentionally break? What feels unexpected?
*   **Rule:** Do not remove the tension just to make the interface more conventional.

## Step 5 — Define a Concept Thesis
Every generated direction must begin with a clear design thesis explaining what the composition is trying to do. Examples:
*   *Typographic Architecture:* Typography becomes the primary structural device.
*   *Editorial Compression:* Dense information zones alternate with large whitespace.
*   *Spatial Narrative:* Scale and transitions make the page feel like a continuous narrative.

## Step 6 — Content Handling
*   Use provided content/requirements as the absolute source of truth.
*   Do not invent claims, statistics, customers, features, or factual content.
*   If content is missing, use lightweight placeholder copy that remains clearly replaceable and supports the hierarchy without using fake facts or unnecessary marketing language.

## Step 7 — Layout Exploration Modes
When exploration is requested, produce meaningfully different layout strategies focusing on hierarchy, scale, pacing, and sequence. Do NOT create variations by only changing colors or radii. Use these three modes:
1.  **Native:** A natural extension of the existing system. Preserves most structural behaviors.
2.  **Evolved:** Preserves core DNA while pushing composition, rhythm, and grid usage.
3.  **Provocation:** A more ambitious interpretation that pushes defining characteristics further while remaining believable within the creative universe.

## Anti-UI Slop Rules
**Strictly Avoid:**
*   Endless rounded cards, cards inside cards, or unnecessary containers.
*   Generic bento grids or predictable SaaS formulas (Hero → Logo Bar → 3 Features → Testimonials → CTA).
*   Blue-purple SaaS gradients, random glassmorphism, or meaningless decorative geometry.
*   Testimonial walls or arbitrary metrics.
*   Centered everything.

**Design the Page, Not the Sections:**
*   Do not solve every section independently. Ensure a unified composition strategy.
*   Control the visual climax, where the page breathes, and how sections transition.

**Restraint & Typography:**
*   Prefer fewer stronger decisions over decoration.
*   If an element only decorates without supporting the composition, remove it.
*   Explore whether typography can replace unnecessary boxes and containers to build structure.

## Code & Auto Layout Quality
Build the UI as usable design work:
*   Use logical nesting, Flexbox/Grid (Auto Layout principles), existing components, and design tokens/variables.
*   Avoid unnecessary absolute positioning unless it is intentional to the composition.

## Creative Director Pass (Self-Correction)
Before outputting, review the direction:
*   *Is there an idea?* (Can it be described in one sentence?)
*   *Is the composition authored?* (Does it look generated, or did someone make specific decisions?)
*   *Is there enough contrast?* (Large vs. small, dense vs. open, loud vs. quiet).
*   *Is anything too safe or unnecessary?* (Remove visual devices that do not contribute).
*   *Slop Detection:* Reject repetitive layouts, uniform spacing, weak hierarchy, and arbitrary gradients. Redesign affected areas; do not just polish them.

## Output Requirements
Generate the new layout code/frames and provide a concise annotation block for each concept:
*   **Concept:** Name of the direction (e.g., `[Page Name] — Native`).
*   **Thesis:** One or two sentences explaining the main idea.
*   **Preserved:** Key Design DNA behaviors retained.
*   **Pushed:** What was intentionally evolved or exaggerated.
*   **Why it works:** Brief explanation of why this composition fits the content and brand.