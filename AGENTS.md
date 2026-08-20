You are working on the Mini Issue Tracker project.

IMPORTANT:
The project already has an established visual language and design direction.
You MUST treat:

frontend/VISUAL_LANGUAGE.md

as the permanent visual source of truth for the UI.

Your job is NOT to invent a new visual style.
Your job is to extend and evolve the existing visual system consistently.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISUAL SOURCE OF TRUTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before changing ANY frontend UI, you MUST:

1. Read `frontend/VISUAL_LANGUAGE.md` completely.
2. Inspect the existing component/page/CSS implementation relevant to the change.
3. Identify which existing visual rules, tokens, components, spacing patterns, typography rules, interaction patterns, and responsive behaviors apply.
4. Reuse existing design tokens and established patterns wherever possible.
5. Do NOT introduce a new visual language for a single page or component.

If the requested feature conflicts with the existing visual language, preserve the established design system unless the user explicitly asks to redesign it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE DESIGN DIRECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The product is a:

"Dense editorial ticket ledger / workbench."

The UI should feel like a carefully designed professional workbench rather than a generic SaaS dashboard.

The visual language is based on:

- warm paper surfaces
- restrained petrol brand color
- strong typography
- hairline rules
- dense but readable information
- editorial hierarchy
- near-zero elevation
- subtle neo-brutalist character
- structured ledgers instead of card grids
- functional color usage
- deliberate spacing
- quiet secondary metadata
- strong primary information
- minimal decoration

The design should NEVER drift toward:

- generic SaaS dashboards
- excessive cards
- floating card-on-card layouts
- gradients
- glassmorphism
- excessive shadows
- excessive rounded corners
- decorative UI with no functional purpose
- oversized empty spacing
- colorful UI for the sake of decoration
- Linear/Vercel clone aesthetics
- fabricated statistics or navigation
- inconsistent component styling

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPLEMENTATION-FIRST RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`VISUAL_LANGUAGE.md` describes the CURRENT IMPLEMENTED visual system.

When the documentation and implementation disagree:

1. Inspect the actual implementation.
2. Determine which behavior is currently intentional.
3. Do not blindly overwrite working implementation based on assumptions.
4. Update `VISUAL_LANGUAGE.md` if the implementation has intentionally evolved.

Do not invent values just because they seem aesthetically reasonable.

Prefer:

existing token → existing component pattern → existing CSS rule → new token only if genuinely necessary.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BEFORE IMPLEMENTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For every UI change, first perform a short visual impact analysis.

Determine:

- Which page(s) are affected?
- Which existing components are affected?
- Which design tokens are relevant?
- Which spacing rules apply?
- Which typography hierarchy applies?
- Which interaction states are required?
- Which responsive breakpoints are relevant?
- Which accessibility patterns already exist?
- Whether an existing component/pattern can be reused.
- Whether the change introduces a genuinely new visual concept.

Do not start modifying CSS immediately.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGN TOKEN RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Always use existing CSS custom properties from the design system.

Do NOT hardcode colors when an existing token exists.

Do NOT introduce arbitrary:

- colors
- spacing values
- border radii
- shadows
- font sizes
- transition durations

unless there is a clear reason.

If a new value is genuinely required:

1. Explain why the existing system cannot express it.
2. Add it as a design token where appropriate.
3. Use the token in the component.
4. Update `VISUAL_LANGUAGE.md`.

The design system should become MORE coherent over time, not accumulate one-off values.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYOUT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prefer structural rules and whitespace over decorative containers.

Use:

- hairline borders
- strong structural rules where appropriate
- aligned columns
- consistent content measures
- editorial spacing
- ruled rows
- compact metadata
- deliberate hierarchy

Avoid:

- unnecessary cards
- nested cards
- excessive container borders
- excessive shadows
- arbitrary padding
- large empty areas
- UI elements that visually compete with the main content

When a section can be represented as a ruled surface or ledger row instead of a card, prefer the ruled surface.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TYPOGRAPHY RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Typography carries hierarchy.

Respect the existing typography scale documented in `VISUAL_LANGUAGE.md`.

General hierarchy:

- page titles = dominant
- section titles = strong but secondary
- issue titles = clear and confident
- ticket keys = compact monospace identifiers
- eyebrows = quiet uppercase metadata
- labels = functional and restrained
- secondary metadata = faint
- counts = tabular and visually strong
- body content = comfortable reading measure

Do not randomly increase font size or weight to make something "stand out."

If something needs more emphasis, first evaluate:

- hierarchy
- spacing
- position
- rule strength
- contrast

before adding visual decoration.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COLOR RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Color has semantic meaning.

Petrol:

- brand
- primary actions
- selected navigation
- important interactive emphasis

Coral:

- destructive actions
- danger
- attention where appropriate

Status colors:

- Open
- In Progress
- Closed

Priority colors:

- Low
- Medium
- High
- Urgent

Do not use status/priority colors as generic decoration.

Do not introduce additional accent colors unless the design system genuinely requires a new semantic role.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE TICKET LEDGER SIGNATURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The ticket ledger is one of the product's strongest visual signatures.

Preserve:

- priority edge-bar
- monospace ticket key
- strong issue title
- status/priority metadata
- assignee information
- trailing directional affordance
- ruled rows
- restrained hover treatment

The ticket key + priority edge-bar combination should remain recognizable across:

- issue lists
- search results
- related issue references
- issue detail headers
- future ticket-related UI

Do not replace this pattern with generic cards.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPONENT REUSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before creating a new UI component, search the existing codebase.

Prefer extending an existing component over creating a visually similar duplicate.

Pay special attention to existing:

- Button
- Badge
- Avatar
- Input
- Select
- Dialog
- ledger rows
- project navigation rows
- fact rail
- comment rows
- empty states
- page headers
- breadcrumbs
- sidebar/navigation patterns

If a new component is needed, it must visually belong to the same family.

Do not create "almost the same" components with slightly different padding, radius, colors, or typography.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSIVE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Responsive behavior is part of the visual language.

Respect the breakpoints and behavior documented in:

`VISUAL_LANGUAGE.md`

Do not treat mobile as a shrunken desktop.

Check:

- desktop
- tablet
- narrow tablet
- mobile
- very narrow mobile

Pay particular attention to:

- 44px touch targets
- ledger row wrapping
- ticket key visibility
- sidebar → icon rail → top bar transitions
- issue detail column stacking
- action button stacking
- form/dialog behavior
- horizontal overflow

Never hide important information simply to make a layout fit.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACCESSIBILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Existing accessibility behavior is part of the design system.

Do not break:

- focus states
- keyboard navigation
- skip-link behavior
- semantic roles
- aria labels
- dialog focus trap
- Escape behavior
- focus return
- error focus
- reduced-motion behavior
- touch target sizing

Visual polish must never come at the expense of accessibility.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATA HONESTY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Never fabricate UI data to make a design look better.

Do not invent:

- counts
- statistics
- navigation items
- project metadata
- labels
- users
- activity
- issue information

If the API does not provide something, design around the available information.

If a new visual element requires unavailable data, explain the limitation instead of fabricating it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHEN ADDING A NEW FEATURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For every new feature:

1. Read `VISUAL_LANGUAGE.md`.
2. Inspect relevant existing implementation.
3. Identify the closest existing visual pattern.
4. Reuse it.
5. Implement the feature.
6. Verify responsive behavior.
7. Verify accessibility.
8. Run existing tests/typecheck/lint/build.
9. Inspect for visual inconsistencies.
10. If the feature introduces a new intentional visual pattern, update `VISUAL_LANGUAGE.md`.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UPDATING VISUAL_LANGUAGE.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`VISUAL_LANGUAGE.md` is a living source of truth.

Update it ONLY when the visual system intentionally changes.

Do NOT rewrite it after every tiny CSS change.

Update it when introducing:

- a new component pattern
- a new semantic color
- a new typography role
- a new spacing/radius/shadow rule
- a new responsive behavior
- a new interaction pattern
- a new page-level layout pattern
- a new visual signature
- a deliberate change to an existing design rule

When updating it:

- document the actual implementation
- preserve the existing terminology
- avoid vague design language
- record exact token values when relevant
- explain where the pattern should be reused
- explain when NOT to use it

The documentation must remain implementation-grounded.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISUAL REVIEW CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before declaring a UI task complete, inspect the result against these questions:

### Hierarchy

- Is the most important information visually dominant?
- Are secondary elements actually secondary?
- Does the page have a clear reading order?

### Rhythm

- Are spacing values consistent with the system?
- Are sections connected through intentional rules and spacing?
- Is there unnecessary empty space?

### Structure

- Are borders doing useful structural work?
- Did we accidentally introduce card-heavy UI?
- Are columns aligned?

### Typography

- Is the established type scale respected?
- Are weights consistent?
- Are ticket keys and metadata treated correctly?

### Color

- Is petrol used intentionally?
- Is coral reserved for danger/attention?
- Are status/priority colors semantic?

### Components

- Does this look like it belongs to the same product?
- Did we reuse existing components?
- Did we accidentally create a duplicate pattern?

### Interaction

- Are hover/focus/pressed states consistent?
- Are transitions consistent?
- Does reduced motion still work?

### Responsive

- Does the design remain intentional at all existing breakpoints?
- Are touch targets large enough?
- Is important information preserved?

### Accessibility

- Is keyboard navigation intact?
- Are focus states visible?
- Are semantic/ARIA hooks preserved?

### Data

- Is every displayed value backed by real application data?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT BEHAVIOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do not "improve" the design by personal taste.

Do not redesign the product unless explicitly asked.

Do not introduce trendy UI patterns just because they look attractive in isolation.

Do not optimize individual components at the expense of system-wide consistency.

Do not make a page visually impressive by breaking the established hierarchy.

The goal is:

CONSISTENCY > NOVELTY
CLARITY > DECORATION
STRUCTURE > CARDS
TYPOGRAPHY > VISUAL NOISE
SEMANTIC COLOR > COLORFULNESS
REAL DATA > FABRICATED UI
REUSE > DUPLICATION

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL OUTPUT REQUIREMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After implementation, report:

1. What changed.
2. Which existing visual patterns were reused.
3. Whether `VISUAL_LANGUAGE.md` needed updating.
4. Any new design decisions introduced.
5. Responsive considerations.
6. Accessibility considerations.
7. Verification results:
   - tests
   - typecheck
   - lint
   - build

If no new visual decisions were introduced, explicitly say:

"No visual language changes were introduced; the existing system was extended."

Do not claim visual verification that you could not actually perform.

The implementation should leave the UI feeling like it was designed by the same person who created the existing Mini Issue Tracker visual system.
