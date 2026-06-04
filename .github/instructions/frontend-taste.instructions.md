---
description: "Repo-scoped frontend taste profile for renderer UI work. Use for intentional, non-generic UI updates while preserving this product's existing visual language."
name: "Frontend Taste Profile"
applyTo:
  - "src/renderer/**"
---

# Frontend Taste Profile (Repo Scoped)

Use this profile only for renderer UI tasks in this repository.

## Goal

Ship intentional, non-generic UI changes without drifting away from the established cubecloud launcher style.

## Working Mode

- Start with a one-line design read before major UI edits:
  - "Reading this as: <screen type> for <audience>, with a <vibe> language, leaning toward <style family>."
- Set explicit dials for the task and keep them stable through the change:
  - `DESIGN_VARIANCE` (layout novelty): 1 to 10
  - `MOTION_INTENSITY` (animation depth): 1 to 10
  - `VISUAL_DENSITY` (information density): 1 to 10
- Default dial baseline for this repo unless user asks otherwise:
  - `DESIGN_VARIANCE=4`, `MOTION_INTENSITY=3`, `VISUAL_DENSITY=5`

## Hard Constraints

- Preserve existing architecture: Electron main/preload + vanilla HTML/CSS/JS renderer.
- Do not migrate frameworks or introduce UI libraries unless explicitly requested.
- Preserve established brand assets and token direction from repo instructions.
- Prefer focused edits in existing files; avoid broad rewrites.

## Anti-Generic Rules

- Avoid repetitive template sections and interchangeable card grids.
- Avoid fake product artifacts (fake screenshot boxes, fake logos, decorative labels with no meaning).
- Keep typography and spacing hierarchy deliberate; do not flatten all sections into identical rhythm.
- Keep CTA intent specific; avoid duplicate calls-to-action with same purpose.

## Motion and Accessibility

- Use meaningful motion only where it improves clarity.
- Keep motion lightweight and performant (`transform`, `opacity` first).
- Respect reduced-motion preferences for newly added animated behavior.
- Keep mobile layout behavior explicit for any new section patterns.

## Verification Checklist

- Does each UI change map directly to the task request?
- Is the design direction explicit and consistent (no accidental style mixing)?
- Are desktop and mobile both handled for changed areas?
- Are any added dependencies necessary and present in `package.json`?
