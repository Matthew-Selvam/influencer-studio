# Redesign Baseline — pre-Stitch inventory

Captured from `main` at the point branch `redesign/stitch-revamp` was cut.
Purpose: the cross-reference checklist. Every item here must still exist and work
after the redesign, or be a deliberate, recorded removal.

**Totals: 17 files, 96 components, 13,325 lines.**

## Critical structural fact: this is TWO sites, not one

`src/site.js` selects a mode from `VITE_SITE_MODE`:

| Mode | Env | Deploys to | Landing | Routes available |
|---|---|---|---|---|
| studio | `studio` (dev default) | ai-influencer-roan.vercel.app | `Landing` | all studio routes + `/fanflow` |
| fanflow | `fanflow` | fan-flow-five.vercel.app | `FanFlowLanding` | `/fanflow` only |

Both modes share `Nav`, `Settings`, `/auth/callback`, the `FeedbackButton`, and Analytics.
**A redesign must be verified in BOTH modes.** Running only `npm run dev` tests studio only.

## Routes (`src/App.jsx`)

| Path | Component | Mode |
|---|---|---|
| `/` | `Landing` / `FanFlowLanding` | both (mode-dependent) |
| `/influencers` | `Influencers` | studio |
| `/inspiration` | `Inspiration` | studio |
| `/brand-deals` | `BrandDeals` | studio |
| `/health` | `CharacterHealth` | studio |
| `/create` | `Create` | studio |
| `/fanflow` | `FanFlow` | both |
| `/settings` | `Settings` | both |
| `/auth/callback` | `AuthCallback` | both |
| `*` | redirect → `/` | both |

App-level, outside the router outlet — easy to drop in a rewrite:
- `FeedbackButton` — fixed bottom-right, links to a Google Form, theme-aware, hover lift
- `<Analytics />` (Vercel)
- `silentRefreshHFToken()` on mount + on `visibilitychange`
- `document.title` set per site mode

## Not reachable by route — mounted inside other pages

These have no route of their own and are the most likely things to be lost:

- **`PhotoStudio.jsx`** (`PhotoStudioPanel`, 1,772 lines) — mounted at `Influencers.jsx:6217`,
  receives `influencer`, `restoreKey`, `onGoToWardrobe`. Not a page despite living in `pages/`.
- **`WardrobeDrawer`** — mounted twice, independently: `PhotoStudio.jsx:1739` and `Influencers.jsx:5740`.
  Both call sites must keep working.
- **`MasonryGrid`, `ImageGrid`** — only consumed by `Influencers.jsx`.
- **`Lightbox`** — shared by `Inspiration`, `BrandDeals`, `Influencers`, `MasonryGrid`, `ImageGrid`.
  Note: `Create.jsx:1054` and `Influencers.jsx:3155` (`MediaLightbox`) define their **own separate**
  lightboxes. Three distinct implementations — do not collapse them assuming they are one.

## Component inventory per file

### src/pages/Influencers.jsx — 6,391 lines, 38 components
The bulk of the app. Sub-features here are effectively their own screens.

Ring, CtxMenu, HeroBanner, GenLoadingOverlay, CharacterSheetSlot, CloseUpSlot,
MainImageSlot, FL, FI, FTA, GenderButtons, ColorPalette, SaveScriptModal,
ScriptsSection, InfoCell, BareInput, DescriptionForm, WardrobeGenerator,
WorldDropCard, WorldDropSection, HomeSection, BrandDealCard, NewBrandModal,
ImportBrandDealsModal, BrandDealSection, NewModal, Sec, Tabs, CSStepHeader,
CSChips, CSProductSlot, WardrobeChipWithHover, MediaLightbox, HistoryCard,
HistoryTab, VideoStripThumb, ContentStudio (2,017 lines on its own), Influencers

Distinct feature areas inside this one file: image slots (main / character sheet /
close-ups ×2), description form, wardrobe generation, world drops, home section,
brand deals (+ import modal), scripts, content studio, history, video strip.

### src/pages/Create.jsx — 1,826 lines, 15 components
Lbl, FloatingCards, StepIndicator, **Step1, Step2, Step3, Step4, Step5**, RefSlot,
PhysicalBuilder, GeneratingScreen, Lightbox, VariationCard, ProviderIcon, Create
→ A 5-step wizard. Step order and per-step state must survive.

### src/pages/PhotoStudio.jsx — 1,772 lines, 6 components
PhotoHistoryThumb, OutfitCard, PropGeneratingSlot, PSec, PSHeader, PhotoStudioPanel

### src/pages/FanFlow.jsx — 740 lines, 17 components
Label, StatCell, EmptyPanel, Avatar, StatusPill, CharStrip, FanRail, MessageBubble,
Typing, EmptyThread, **TraceView, RelationshipView, MemoryView, EventsView, SystemView**,
OfflineState, FanFlow
→ Five distinct inspector views + an offline state. The offline state is easy to miss
because it only renders when the backend is down.

### src/pages/BrandDeals.jsx — 431 lines, 3 components
NewDealModal, DealCard, BrandDeals

### src/pages/Settings.jsx — 338 lines, 2 · Inspiration.jsx — 257 lines, 3 (BoardCard, BoardDetail)
### src/pages/Landing.jsx — 265 lines, 1 · FanFlowLanding.jsx — 203 lines, 1
### src/pages/CharacterHealth.jsx — 123 lines, 3 (Section, Stat)
### src/pages/AuthCallback.jsx — 70 lines, 1

### src/components/ — 5 files, 5 components
Nav (169), WardrobeDrawer (243), ImageGrid (172), Lightbox (120), MasonryGrid (103)

## Cross-cutting systems that must not regress

- **Theme** — `src/context/theme.jsx`, `useTheme()` / `isDark`. Styling is **inline JS objects
  reading `isDark`**, not CSS classes. Any move to CSS/Tailwind rewrites the entire styling layer.
- **Store** — `src/store.jsx`, `StoreProvider`.
- **CSS variables** — `var(--bg-tertiary)` etc. from `src/index.css`.
- **Auth** — `utils/higgsfieldAuth.js`, silent token refresh, `/auth/callback`.
- **Generation providers** — `utils/higgsfieldGenerate.js`, `utils/wavespeedGenerate.js`.
- **Prompt builders** — `systemPrompt`, `charSheetPrompt`, `photoStudioPrompt`,
  `backstoryAnalysis`, `influencerUtils`, `locationPreviews`, `imageUtils`, `exportCard`, `fanflow`.
- **`react-portal` usage** — several overlays render via `createPortal` with `data-portal`
  and rely on `onMouseDown` stop-propagation to avoid closing parents.

## Verification checklist (run after each screen is redesigned)

- [ ] `VITE_SITE_MODE=studio npm run dev` — every studio route renders
- [ ] `VITE_SITE_MODE=fanflow npm run dev` — landing + `/fanflow` render
- [ ] Light AND dark theme on every screen
- [ ] All three lightbox implementations still open/close
- [ ] `WardrobeDrawer` works from both call sites
- [ ] Create wizard completes all 5 steps
- [ ] FanFlow: all 5 inspector views + offline state
- [ ] FeedbackButton present on every route
