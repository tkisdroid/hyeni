# CLAUDE.md — Hyeni × Wanted Design System Migration

This file is loaded by Claude Code on every turn. Follow these rules without exception.

---

## Project context

- **App**: 혜니캘린더 (com.hyeni.calendar) — family schedule sync
- **Stack**: Capacitor + React + TypeScript + Tailwind CSS + Supabase
- **Migration goal**: apply Wanted Design System tokens; preserve existing brand colors and bespoke component layouts
- **Source of truth**: `WANTED_DS_SPEC.md` (this directory)
- **Current phase**: see `MIGRATION_PLAN.md`

---

## Hard rules — never violate

1. **Token-only colors.** Never write hex/rgb/hsl values directly in component code. Always use CSS variables defined in `src/styles/tokens.css`. If you need a color that isn't in the tokens, **STOP and ask**.

2. **Token-only spacing & radius.** Use `--space-*` and `--radius-*` variables. No magic px values like `padding: 13px` or `borderRadius: 18`.

3. **Pretendard JP.** Body text uses `var(--font-sans)` which has Pretendard JP first. Do not change the font stack. Do not load other fonts.

4. **Body weight 500.** Body text is `font-weight: 500` (`--weight-medium`). Never use 400 for body. Bold is 700, button text is 600.

5. **Cards: stroke + no shadow.** Default cards use `border: 1px solid var(--line-soft)` and `box-shadow: none`. Use `.card-elevated` only for floating UI (modals, dropdowns, toasts).

6. **Single source per component.** When migrating, replace inline styles AND duplicate classNames with the canonical class (`.card`, `.input`, `.btn-primary` etc). Do not leave both.

7. **Preserve existing logic.** Never modify event handlers, prop interfaces, hooks, or Supabase calls during a design migration. Design tokens only.

8. **Dark-mode-aware always.** Even if working in light mode, never hardcode `#fff` or `#000` — always use `var(--bg-base)`, `var(--fg-primary)`. All values must work in both themes.

---

## Workflow rules

9. **Phase scope.** Work only on the phase the user invoked. Do not "while you're at it" fix other phases.

10. **Candidate-list-first.** For migrations affecting multiple files (cards, buttons, inputs), first list all candidate files with the proposed change in a table, wait for explicit user approval, **then** apply.

11. **Stop and ask, never invent.** If you encounter:
    - A color that doesn't map to any token
    - A button whose variant (primary/secondary/destructive) is ambiguous
    - A component that doesn't fit the standard patterns
    - A status color (positive/negative/cautionary) — values are TODO in spec
    
    → STOP. List the items. Ask the user.

12. **Verify after each phase.** Run `npm run build` and `npx tsc --noEmit`. Report any errors before declaring the phase complete.

13. **One phase = one commit.** Commit message format:
    ```
    wanted-ds: phase N — [short summary]
    ```

14. **Destructive variant guard.** Never auto-classify a button as `btn-destructive`. Explicitly ask the user. Mis-classification can cause accidental data loss.

15. **Bespoke components.** These have brand value and must NOT be replaced with generic tokens — only have the `.card` baseline applied while preserving internal layout:
    - 일정 카드 (calendar event card)
    - 혜니 포인트 표시
    - 가족 멤버 카드 / avatar group
    - 캘린더 그리드

---

## What "done" looks like for each phase
See `MIGRATION_PLAN.md` for explicit acceptance criteria per phase.

## When in doubt
Quote the relevant section of `WANTED_DS_SPEC.md`. If the spec doesn't cover the case, ask the user — never make a stylistic decision unilaterally.
