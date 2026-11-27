# RestoPilot AI — Frontend UX Architecture

## Experience direction

The public site introduces RestoPilot as a WhatsApp-first restaurant operating system. The
authenticated workspace prioritizes operational clarity over a generic admin-template aesthetic:
deep navy surfaces, restrained green for action, violet for AI, quiet borders and readable data.

Landing and assistant conversations are illustrative, not live service evidence. The dashboard
reads current branch, menu, order and customer APIs. Reservation, analytics, campaign and AI
integrations are visibly marked as not connected. Performance figures are product targets, not
verified customer results.

## Component hierarchy

```text
App
├── LandingComponent (lazy, public)
│   ├── Responsive site navigation
│   ├── Hero conversation preview
│   ├── Trust and problem/solution sections
│   ├── FeatureTileComponent (reusable)
│   ├── How-it-works timeline
│   ├── AI conversation showcase
│   ├── ProductPreview tabs
│   ├── Pricing tiers
│   ├── FaqItemComponent (reusable native disclosure)
│   └── CTA / footer
├── LoginComponent (lazy)
└── Authenticated workspace
    ├── DashboardComponent (lazy)
│   ├── Workspace navigation and integration state
│   ├── KPI strip and AI-preview recommendation
│   ├── Orders / recent activity
│   └── Menu / branches / customer summaries
    └── AssistantComponent (lazy, guarded)
        ├── Restaurant context
        ├── Suggested prompts
        ├── Conversation preview
        └── Composer with explicit preview-only response
```

Reusable landing components are standalone and use signal inputs. Landing sections remain composed
in the page template until their content or behavior needs independent reuse; avoid splitting every
heading into a component without a reuse or testing benefit.

## Routing and access

| Route | Access | Experience |
|---|---|---|
| `/` | Public | Lazy-loaded marketing landing page |
| `/login` | Public | Invitation-based sign-in |
| `/dashboard` | `authGuard` | Restaurant overview |
| `/dashboard/assistant` | `authGuard` | AI copilot preview |
| Unknown path | Public redirect | Return to landing |

Keep route-level lazy loading. Client-side route guards do not replace API authorization.

## Angular folders

```text
frontend/src/app/
  core/auth/
  features/
    landing/
      landing.component.{ts,html,scss,spec.ts}
      components/
        feature-tile.component.ts
        faq-item.component.ts
    auth/
    dashboard/
      dashboard.component.{ts,html,scss}
      assistant/
        assistant.component.{ts,html,scss,spec.ts}
  app.routes.ts
```

When sections gain independent data or behavior, split them into `hero/`, `features/`, `pricing/`,
`faq/` and `footer/` folders.

## Design tokens

| Token | Value | Use |
|---|---|---|
| `pilot.green` | `#25D366` | Primary actions and healthy state |
| `pilot.ink` | `#0F172A` | Deep text/surface foundation |
| `pilot.violet` | `#7C3AED` | AI accents |
| `pilot.night` | `#020617` | Dark canvas |
| `pilot.card` | `#0B1220` | Dark panels |
| `pilot.muted` | `#94A3B8` | Secondary text |

Plus Jakarta Sans is used for display/UI, Inter as fallback and DM Mono for compact metadata.
Tailwind tokens live in `tailwind.config.js`; bespoke visuals and page composition use component
SCSS.

## Responsive behavior

- **Wide desktop (>= 1200px):** full sidebar and two-column hero; four-column feature/KPI grids.
- **Tablet (760–1199px):** narrower workspace sidebar, two-column metrics/features, stacked panels.
- **Mobile (< 760px):** collapsible landing navigation; dashboard slide-in sidebar and scrim; AI
  assistant context rail hidden to give conversation and composer full width.
- **Small mobile (< 500px):** single-column feature/pricing cards, compact order table, scrollable
  product tabs and reduced decorative elements.
- Honor `prefers-reduced-motion`; keep controls keyboard-operable and wide tables independently
  scrollable. Prevent horizontal page overflow.

## Wireframes

### Landing

Sticky minimal navigation; two-column hero with WhatsApp proposition and illustrative conversation;
trust-target row with validation disclaimer; before/after comparison; feature grid; four-step
timeline; AI conversation preview; switchable dashboard mockup; pilot-oriented pricing; native FAQ
disclosures; final CTA and compact footer.

### Dashboard

Dark sidebar with workspace identity and integration state; compact top bar with order search,
notifications, theme and profile actions; four KPI panels; explicit AI-preview strip; recent orders
and activity; menu, branch and customer summaries; reservation placeholder; assistant entry point.
Live values come from the available APIs.

### AI assistant

Top bar with workspace return, copilot identity and preview status; optional restaurant context
rail; central conversation surface and suggested prompts; composer with keyboard send support; clear
notice that the preview neither calls an AI provider nor executes restaurant actions.

## Implementation plan

1. Keep public, login and protected workspace routes lazy and verify guard behavior.
2. Connect public CTAs to the current invitation-based sign-in; do not imply public signup exists.
3. Keep dashboard metrics tied to existing tenant APIs; never synthesize live revenue or
   reservations from sample data.
4. Replace illustrative assistant responses only after authorized orchestration exists; require
   confirmation for writes.
5. Add API-backed reservations, reporting and campaign pages as backend modules ship.
6. Validate build, unit tests, desktop/mobile layout, keyboard access, reduced motion and loading,
   error and empty states.
