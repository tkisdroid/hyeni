# Soft Brand Visual System Redesign

Date: 2026-05-04
Project: 혜니캘린더
Scope: App-wide visual system refresh without functional changes

## Decision

Use the **A. Soft Brand** direction.

The app keeps the current 혜니 brand warmth, but the visual system is reduced and made more consistent: softer pink, warmer cream surfaces, thinner borders, shallower shadows, and more controlled radius values.

No new AI-generated image assets are part of this redesign. The existing child emoticon/logo assets remain the image source of truth. Typography stays on Pretendard, using the existing `public/fonts/PretendardVariable.woff2` and current font-family stack.

## Non-Goals

- Do not change routing, authentication, pairing, calendar, memo, location, push, subscription, or safety behavior.
- Do not change API request or response shapes.
- Do not change database schema, Supabase calls, realtime subscriptions, Capacitor native calls, or Android code.
- Do not decompose `src/App.jsx`.
- Do not add new libraries.
- Do not replace existing child emoticon/logo assets with generated images.

## Visual Thesis

Hyeni should feel warm and parent-friendly, but less decorative: cream background, white functional surfaces, restrained Hyeni pink for brand and primary actions, and quiet status colors for safety and state.

## Content Plan

The existing screens stay structurally intact:

- Entry and auth screens: keep the current role-selection flow, logo placement, and call-to-action order.
- Parent home and calendar: keep child cards, action shortcuts, calendar, event list, and bottom tabs.
- Memo screens: keep chat layout, quick replies, composer, and read state behavior.
- Safety and tool screens: keep existing emergency, friend playdate, subscription, and permission surfaces.
- Child-facing screens: keep child-oriented labels and existing emoticon treatment, but reduce overly strong gradients and shadows.

## Interaction Thesis

The redesign should not introduce new gestures or workflow behavior.

- Keep existing button, tab, card, and modal interactions.
- Preserve current loading, disabled, empty, and error states.
- Keep motion subtle: short entry/list fade and small active press feedback only.

## System Rules

### Color

- Keep Hyeni pink as the brand accent and primary action color.
- Use cream/off-white page backgrounds rather than saturated pink/orange/blue gradient fields.
- Use white for most cards, sheets, inputs, and list rows.
- Keep semantic colors stable:
  - parent blue remains parent-related state/action color
  - success green remains safe/live/ready color
  - caution orange remains warning/non-destructive attention color
  - red remains destructive/emergency only

### Typography

- Keep Pretendard as the app typeface.
- Do not add another font.
- Keep Korean UI labels dense and readable.
- Do not scale font size with viewport width.
- Keep letter spacing at `0` inside app UI.

### Radius

- Main cards and list rows: 16-18px.
- Buttons and compact controls: 12-14px.
- Icons/avatar tiles: 10-14px.
- Pills/chips: full radius.
- Reduce large 22-32px radius values unless they are modal/sheet containers that already need a softer shape.

### Shadow

- Remove large decorative pink shadows from routine cards.
- Use borders first, shadow second.
- Keep a shallow, low-opacity shadow only on:
  - primary role/action selection
  - fixed bottom tabbar
  - modals/sheets
  - logo/emoticon surfaces where it improves separation

### Images And Icons

- Existing child emoticon/logo assets remain in use.
- No new GPT image model generation for this pass.
- Avoid AI-like background art, abstract generated scenes, or decorative images behind routine UI.
- Emoji can remain where they are functional labels today, but repeated action surfaces should be visually normalized through consistent tile/background treatment.

## Implementation Architecture

The implementation should be CSS-first.

Primary files:

- `src/styles/tokens.css`: align shared surface, brand, radius, and shadow tokens with the Soft Brand direction.
- `src/App.css`: normalize Hyeni app-specific surfaces, cards, calendar, tabbar, memo, and tool styling.
- `src/App.jsx`: only adjust static inline visual constants if CSS cannot reach them. Do not change handlers, state, effects, data fetching, conditionals, or component structure.
- Existing component CSS/inline styles under `src/components/**`: only small visual value updates when a component is not covered by global app CSS.

The current `src/App.jsx` monolith policy remains intact. No extraction or behavioral refactor is allowed.

## Component Coverage

### Entry/Auth

- Keep existing logo/emoticon source.
- Keep role buttons and click handlers unchanged.
- Tone down shell gradient and role button shadows.
- Keep the child role as the stronger branded action when the current structure already emphasizes it.

### Parent Home

- Normalize child cards, action chips, memo preview, event cards, and section headings.
- Keep existing information density and event order.
- Keep live/safety dots and status colors.

### Calendar

- Keep month navigation, selected date, today state, event dots, and add buttons.
- Reduce saturated button gradients where possible.
- Keep primary add action visually clear.

### Bottom Tabbar

- Keep five-tab structure and active tab behavior.
- Reduce active-state gradient/shadow intensity.
- Maintain touch target size.

### Memo

- Keep chat messages, sender labels, quick replies, composer, and read state unchanged.
- Reduce patterned/gradient phone backgrounds.
- Keep child memo variation, but make it consistent with Soft Brand surfaces.

### Tool And Safety Screens

- Keep emergency/friend/success/warning semantic accents.
- Do not weaken emergency affordance.
- Use the shared card radius, border, and shallow-shadow rules.

## Error Handling

No functional error handling changes are expected. Existing error, permission, loading, and empty states must remain reachable and readable after the visual changes.

Any CSS update that affects dialogs, modals, or fixed bottom UI must preserve:

- readable text contrast
- visible focus outlines
- tappable controls
- no clipped labels on 320px+ widths
- safe-area padding behavior

## Testing And Verification

Required checks after implementation:

- `npm run build`
- Mobile browser screenshot at 390x844 for the entry screen
- Browser check that the app renders without console runtime errors
- Manual visual scan of:
  - entry/auth screen
  - parent home or available default signed-out state
  - calendar styling where reachable
  - fixed bottom tabbar where reachable
  - modal/sheet surfaces where reachable

If authenticated production-like flows are not locally reachable without credentials, do not fake data in production code. Verify reachable UI plus build, and document any remaining manual verification gap.

## Acceptance Criteria

- App-wide visual tone follows Soft Brand: warm, simple, refined, not AI-generated.
- Existing child emoticon/logo remains the image asset.
- Pretendard remains the only app font family.
- No new dependencies are added.
- No business logic, API calls, database calls, subscriptions, native calls, or route behavior changes.
- Build passes after the changes.
- Text remains readable and controls remain tappable on mobile.

## Spec Self-Review

- Placeholder scan: no placeholders or TODOs remain.
- Internal consistency: image guidance, typography guidance, and implementation scope all match the selected Soft Brand direction.
- Scope check: the work is a visual-system pass only and does not include feature work.
- Ambiguity check: no new AI image generation is allowed in this pass; existing child emoticon/logo assets must be used.
