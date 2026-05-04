# Soft Brand Visual System Redesign

Date: 2026-05-04
Project: 혜니캘린더
Scope: App-wide visual system refresh without functional changes

## Decision

Use the **A. Soft Brand** direction.

The app keeps the current 혜니 brand warmth, but the visual system is reduced and made more consistent: softer pink, warmer cream surfaces, thinner borders, shallower shadows, and more controlled radius values.

Image model usage is allowed when it produces a clearly better, production-ready visual result, but generated assets must stay aligned with the existing child emoticon/logo direction and must not introduce an AI-generated look. Typography stays on Pretendard, using the existing `public/fonts/PretendardVariable.woff2` and current font-family stack.

## Non-Goals

- Do not change routing, authentication, pairing, calendar, memo, location, push, subscription, or safety behavior.
- Do not change API request or response shapes.
- Do not change database schema, Supabase calls, realtime subscriptions, Capacitor native calls, or Android code.
- Do not decompose `src/App.jsx`.
- Do not add new libraries.
- Do not replace existing child emoticon/logo assets unless a generated asset is explicitly saved as a non-destructive new asset and verified in-browser.

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

The redesign should not introduce new workflows or change the result of existing gestures.

- Keep existing button, tab, card, and modal interactions.
- Preserve current loading, disabled, empty, and error states.
- Scroll behavior, calendar feel, button names, labels, and guidance copy may be refined when it improves clarity and perceived speed.
- Keep motion subtle: short entry/list fade, smooth scrolling where safe, and small active press feedback only.

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

- Existing child emoticon/logo assets remain the baseline visual language.
- GPT image model generation may be used for polished replacements or supporting visual assets only when the output is less generic, not obviously AI-generated, and improves the production feel.
- Generated assets must be committed under project-controlled asset paths and referenced only after browser verification.
- Avoid AI-like background art, abstract generated scenes, or decorative images behind routine UI.
- Emoji can remain where they are functional labels today, but repeated action surfaces should be visually normalized through consistent tile/background treatment.

### Selection And Tap Reliability

- All buttons and button-like controls must prevent accidental text selection.
- Tapping a control must prioritize the click/tap action rather than selecting/copying button text.
- Use `user-select: none`, `-webkit-user-select: none`, `touch-action: manipulation`, and stable touch target sizing for controls.
- Do not disable selection globally for text content that users may reasonably copy, such as pair codes.

## Implementation Architecture

The implementation should be CSS-first.

Primary files:

- `src/styles/tokens.css`: align shared surface, brand, radius, and shadow tokens with the Soft Brand direction.
- `src/App.css`: normalize Hyeni app-specific surfaces, cards, calendar, tabbar, memo, and tool styling.
- `src/App.jsx`: only adjust static inline visual constants if CSS cannot reach them. Do not change handlers, state, effects, data fetching, conditionals, or component structure.
- Existing component CSS/inline styles under `src/components/**`: only small visual value updates when a component is not covered by global app CSS.
- `public/` or `src/assets/`: add generated image assets only if they pass visual review and are referenced by UI code without replacing behavior.

The current `src/App.jsx` monolith policy remains intact. No extraction or behavioral refactor is allowed.

## Component Coverage

### Entry/Auth

- Keep existing logo/emoticon source.
- Keep role buttons and click handlers unchanged.
- Tone down shell gradient and role button shadows.
- Keep the child role as the stronger branded action when the current structure already emphasizes it.
- Copy may be shortened or clarified as long as the selected role and login/pairing meaning remain unchanged.

### Parent Home

- Normalize child cards, action chips, memo preview, event cards, and section headings.
- Keep existing information density and event order.
- Keep live/safety dots and status colors.

### Calendar

- Keep month navigation, selected date, today state, event dots, and add buttons.
- Improve calendar visual density, selected/today affordances, and perceived responsiveness without changing date math or event filtering.
- Reduce saturated button gradients where possible.
- Keep primary add action visually clear.

### Bottom Tabbar

- Keep five-tab structure and active tab behavior.
- Reduce active-state gradient/shadow intensity.
- Maintain touch target size.
- Prevent text selection on all tab buttons.

### Memo

- Keep chat messages, sender labels, quick replies, composer, and read state unchanged.
- Reduce patterned/gradient phone backgrounds.
- Keep child memo variation, but make it consistent with Soft Brand surfaces.
- Preserve message text selection where it is content, but prevent selection on quick reply buttons and send controls.

### Tool And Safety Screens

- Keep emergency/friend/success/warning semantic accents.
- Do not weaken emergency affordance.
- Use the shared card radius, border, and shallow-shadow rules.
- Button labels and guidance copy may be clarified where it reduces user error.

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
- Mobile browser check that button taps do not select button text.
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
- Existing child emoticon/logo direction remains the image baseline; any generated asset must look product-ready and non-generic.
- Pretendard remains the only app font family.
- No new dependencies are added.
- No business logic, API calls, database calls, subscriptions, native calls, or route behavior changes.
- Build passes after the changes.
- Text remains readable and controls remain tappable on mobile.
- Buttons and button-like controls do not accidentally select text during taps/clicks.

## Spec Self-Review

- Placeholder scan: no placeholders or TODOs remain.
- Internal consistency: image guidance, typography guidance, selection behavior, and implementation scope all match the selected Soft Brand direction.
- Scope check: the work is a visual-system pass only and does not include feature work.
- Ambiguity check: image generation is allowed only for product-ready visual polish; behavior changes remain out of scope.
