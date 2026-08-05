# design-system Specification

## Purpose

Establish a single Odoo-light design token layer and reusable UI primitives
(Card, Button, Badge) so all components draw from one palette source of truth.
Chart colors MUST also resolve through tokens, not hardcoded literals.

## Requirements

### Requirement: Design Token Layer

The system MUST define all color and radius values as CSS custom properties in
`src/app/globals.css` using the approved Odoo light palette. No component or
stylesheet outside `globals.css` SHALL declare these values directly.

Required tokens (exact values):

| Token | Value |
|-------|-------|
| `--color-bg` | `#F8F8F8` |
| `--color-surface` | `#FFFFFF` |
| `--color-surface-2` | `#F0F0F0` |
| `--color-border` | `#E2E8F0` |
| `--color-text` | `#212B36` |
| `--color-text-muted` | `#6B7280` |
| `--color-primary` | `#714B67` |
| `--color-primary-hover` | `#5C3D54` |
| `--color-primary-contrast` | `#FFFFFF` |
| `--color-positive` | `#00875A` |
| `--color-negative` | `#DE350B` |
| `--color-warning` | `#FF8B00` |
| `--radius` | `0.5rem` |

#### Scenario: Token file defines all required variables

- GIVEN the app CSS is loaded
- WHEN `getComputedStyle(document.documentElement).getPropertyValue('--color-primary')` is called
- THEN the resolved value MUST equal `#714B67` (trimmed)

#### Scenario: No hardcoded color class remains in refactored components

- GIVEN a static analysis pass over refactored component files
- WHEN searching for `bg-amber-600`, `text-red-600`, `#d97706`, or similar Tailwind color utilities not mapped to a token
- THEN zero matches are found in any file under `src/components/` or `src/app/`

---

### Requirement: Card Primitive

The system MUST provide a `Card` component at `src/components/ui/card.tsx` that
renders a surface container using `--color-surface`, `--color-border`, and
`--radius` tokens. It MUST accept `children` and an optional `className` prop.

#### Scenario: Card renders with token-based styles

- GIVEN the Card component is mounted in a test
- WHEN rendered with no extra props
- THEN the root element carries classes or inline styles that resolve to `background: var(--color-surface)` and `border-radius: var(--radius)`

#### Scenario: Card accepts and forwards className

- GIVEN the Card component is mounted with `className="mt-4"`
- WHEN the DOM is queried
- THEN the root element includes both the base token class and `mt-4`

---

### Requirement: Button Primitive

The system MUST provide a `Button` component at `src/components/ui/button.tsx`
with three visual variants: `primary`, `secondary`, and `ghost`. The `primary`
variant MUST use `--color-primary` as background and `--color-primary-contrast`
as text. The component MUST be keyboard-accessible and forward `onClick` and
`disabled` props.

#### Scenario: Primary variant renders with primary token colors

- GIVEN a Button with `variant="primary"` is mounted
- WHEN rendered
- THEN it carries a class/style that maps to `background: var(--color-primary)` and `color: var(--color-primary-contrast)`

#### Scenario: Disabled button is not interactive

- GIVEN a Button with `disabled={true}` is mounted
- WHEN a click event is dispatched
- THEN the `onClick` handler is NOT called
- AND the element has `aria-disabled` or the native `disabled` attribute

#### Scenario: Ghost variant has no background fill

- GIVEN a Button with `variant="ghost"` is mounted
- WHEN rendered
- THEN it does not carry the primary background class/style

---

### Requirement: Badge Primitive

The system MUST provide a `Badge` component at `src/components/ui/badge.tsx`
that renders an inline label. It MUST support at least `positive`, `negative`,
and `warning` color intents mapped to the corresponding design tokens.

#### Scenario: Positive badge uses positive token

- GIVEN a Badge with `intent="positive"` is mounted
- WHEN rendered
- THEN its computed color resolves to `var(--color-positive)` or `#00875A`

#### Scenario: Negative badge uses negative token

- GIVEN a Badge with `intent="negative"` is mounted
- WHEN rendered
- THEN its computed color resolves to `var(--color-negative)` or `#DE350B`

---

### Requirement: Token-Driven Chart Colors

Chart color props MUST resolve through the design token layer at runtime. No
component SHALL pass a hardcoded hex string as a Recharts color prop. A helper
MUST read `getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()`
(or the relevant token) client-side and pass the resolved value to Recharts.

#### Scenario: Chart renders with resolved token color

- GIVEN the dashboard chart component is mounted with the DOM providing token values
- WHEN the chart helper resolves `--color-primary`
- THEN the value passed to the Recharts `fill` or `stroke` prop equals the resolved CSS variable value, not a hardcoded literal

#### Scenario: Token change propagates to chart color

- GIVEN `--color-primary` is overridden to `#FF0000` in the test DOM
- WHEN the chart helper is called
- THEN it returns `#FF0000`, not the default `#714B67`
