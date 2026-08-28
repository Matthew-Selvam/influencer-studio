# Stitch screen prompts — round 3, "Atelier"

Round 2 ("Synthetic Command" — dark glass, neon gradients, mono command-center
IDs) was rejected as generic AI-dashboard cliché. This round keeps every
component, field, and feature from round 2 exactly — same 8-influencer roster,
same 14 aesthetic-style cards, same wizard steps, same deal/health/settings
fields — and changes only the surface language.

Direction: an editorial photo-studio tool, not a sci-fi HUD. The product's
actual content is fashion photography, so the UI should recede and let images
carry the weight, the way Linear or Figma's chrome recedes for the work inside
it. No gradients, no glow, no glassmorphism, no monospace terminal IDs, no
neon. Dark only — no light theme.

Generate in Stitch project **"FanFlow — AI Creator OS"**
(`projects/17753558777913679175`), design system **Atelier** (new — do not
reuse Synthetic Command), device **Desktop**. The 4 screens already generated
under Synthetic Command (FanFlow Landing ×2, FanFlow Dashboard ×2) are
**out of scope for this round** — they're the FanFlow tab, not Workspace, and
weren't part of the "looks ass" complaint. Regenerate them separately if this
direction is approved.

## Shared visual language

- **Background** — warm near-black `#15130F`, not cold blue-black. Panels one
  step lighter, `#1E1B17`, flat — no blur, no translucency, no inner glow.
  Separation comes from a 1px hairline border, `rgba(243,237,228,0.08)`.
- **Type** — a serif display face (Canela / Reckless / EB Garamond register)
  for headlines and section titles; a clean grotesque (Inter register) for
  body copy, labels, and form fields. This pairing is the main thing that
  reads "considered" instead of "generated" — lean on it.
- **Color** — bone text `#F3EDE4` on warm black, warm gray `#9A9186` for
  secondary text. One accent only: a muted safelight red-orange `#C15B3A` —
  desaturated, not the saturated pink/purple of round 2. Reserve it for the
  single primary action per screen, active-state indicators, and destructive
  actions. Everything else stays bone/gray/black. If a screen wants to reach
  for the accent a second time, it shouldn't.
- **No mono ID tags.** Drop `[INF-002]`, `[SYS-042]`, `[DEAL-003]` etc.
  entirely — that ledger-system conceit is part of what read as generic.
  Where round 2 used one for identification, use a plain small-caps eyebrow
  label instead (e.g. "Fashion · Age 22", not "[INF-002]").
  Reserve monospace for information that is genuinely tabular or technical —
  file counts, timestamps, connection status — not decoration.
- **Radius** — small and consistent, 2–4px. Editorial, not soft/bubbly.
- **Spacing** — generous. Round 2 was dense on a 4px base unit; this round
  should feel like it has room to breathe, closer to a print layout.
- **Photography** — full-bleed where the content is a photo (profile images,
  generated shots, mood boards). Let images run to the panel edge rather than
  sitting in a bordered thumbnail slot.

App chrome for screens 1–8: 52px flat top nav on the panel background, no
blur — serif "Influencer Studio" wordmark left, links **Workspace** (active),
**Inspiration**, **Brand Deals** in the grotesque, right side a single
accent-outlined "+ Create" button (outline, not filled — filled is reserved
for the screen's one primary action) + avatar. Workspace screens additionally
get a simple two-item tab bar under the nav — **Influencers** | **FanFlow** —
active tab marked by a 2px accent underline, no sliding pill, no glow.

---

## 1. Workspace — Influencers / Profile tab

Character profile editor inside an editorial photo-studio tool. Desktop,
1440px, single app screen (not marketing).

Top nav and tab bar as above, "Influencers" tab active.

LEFT RAIL (280px, hairline right border): small-caps eyebrow "Roster" + a
plain `+` text button (no icon chip). 8 character rows stacked with generous
vertical spacing: circular avatar photo, name (Kayla, Camila, Marcus, Brad,
Olivia, Derek, Joshua, Jake), niche in warm-gray small text (Fashion / Fitness
/ Tech / Travel / Coffee), a thin 1px completeness bar in bone at low opacity
with the accent fill only on the selected row's bar. Selected row (Camila) is
marked by a left accent rule, not a glow.

MAIN PANEL: profile editor for "Camila".
Header row: serif display name "Camila", small-caps eyebrow "Female · Fashion
· Age 22", thin completeness bar "56% profile complete" in bone/accent, a
plain text "Delete" link in warm-gray (not a red ghost button — destructive
stays quiet until hovered, then turns accent).
Sub-tabs: **Profile** (active, accent underline) · Photos · Videos.
Row of 3 full-bleed image panels, no card chrome: Main Image (fashion portrait
of a young woman), Character Sheet (multi-pose reference grid), Close Ups (two
portraits). A small-caps label sits below each image, not stamped on a corner
tag. Regenerate / Replace appear as plain text links on hover, bottom-left of
the image, no button chrome.
Below: "Prompt Builder" panel, serif section title. Left vertical sub-nav in
the grotesque: Overview (active, accent underline), Scripts, Wardrobe, Home,
Brand Deals, History. Right side — the SAME dense form grid as round 2, just
restyled: Identity segmented control ♀/♂, Age number input, Niche select,
Location input, Backstory textarea, Personality slider Introvert↔Extrovert,
Target Audience textarea, Physical Description textarea, Hobbies chip input,
Aesthetic/Style Vibe input, Dream Brands chips, Content Pillars chips, Brand
Colors swatch row (6 dots), Voice/TTS select. Hairline-bordered fields, warm
gray placeholder text, no dimmed-mono affect.

---

## 2. Workspace — Influencers / Photos tab (Content Studio)

Same screen structure as screen 1 (nav, Influencers tab, same left roster with
Camila selected, same header — serif name, eyebrow, 56% bar), active sub-tab
now **Photos**.

Main panel:
- Toolbar: serif "Content Studio" label, filter text-links (All, Portraits,
  Full body, Close ups — active one accent-underlined, not chip pills), a
  plain sort dropdown, "New Shoot" as the screen's one filled accent button.
- Full-bleed masonry of 8–10 photo history images, no card borders — a photo
  simply sits in the grid. Below each: a single small-caps metadata line
  (outfit · location · pose) and a faint timestamp in warm-gray. Hover reveals
  Restore / Variations / Delete as plain text links along the bottom edge of
  the image, not an overlay panel. One image has a small "Pinned" label,
  top-left, plain text over a soft gradient-free scrim only where needed for
  legibility.
- Below the grid: "Video Strip" — a horizontal row of 4 video frames (first
  frame as thumbnail), a thin play triangle, duration as small-caps text
  beneath, not stamped mono-on-thumbnail.
- Right docked panel (320px, hairline left border, no glass): "Shoot Config"
  serif label — outfit text-chips (Sporty, Yoga, Streetwear…), pose select,
  3 prop drop-slots as simple dashed-border squares, lighting select, and a
  full-width filled accent "Generate" button — the panel's one filled action.

---

## 3. Create wizard — Step 1 of 5 (Basics)

Step 1 of 5, editorial photo-studio tool, desktop. Top nav as above (no
Workspace tab bar — this is its own flow).

Centered column, max-width 720px (narrower than round 2 — more whitespace):
- Step indicator: 5 plain small-caps labels in a row — **Basics** (active,
  bone text + accent underline), References, Story, Look, Generate (dimmed
  warm-gray) — connected by a 1px hairline rule, no glowing dots, no numeral
  badges.
- Serif section title "Basics."
  - Name input (placeholder "e.g. Kayla")
  - Gender segmented control ♀ Female / ♂ Male
  - Age number input
  - Niche select (Fashion, Fitness, Travel, Tech, Food, Lifestyle)
  - Aesthetic Style: the SAME 14-card grid as round 2 — Minimalist 🤍 "Clean,
    simple, less is more", Old Money 🏛 "Understated wealth & heritage", Clean
    Girl 🫧 "Effortless, dewy, no-makeup look", Editorial 🖤 "High fashion,
    bold & structured", Streetwear 🧢 "Urban, casual street style", Bohemian
    🌿 "Earthy, flowy, free-spirited", Glam ✨ "Dressy, dramatic & glamorous",
    Preppy 🎓 "Classic, collegiate, polished", Sporty ⚡ "Athletic &
    activewear vibes", Dark & Moody 🌙 "Alternative, edgy & dramatic", Y2K 💿
    "2000s nostalgia & pop culture", Cottagecore 🌸 "Romantic, vintage &
    nature", Tech Bro 💻 "Smart-casual, Silicon Valley", Coastal 🌊 "Linen,
    nautical, sun-worn" — but as flat hairline-bordered cards, selected state
    marked by an accent border only (no glow, no fill).
- Footer: "Continue" as the screen's one filled accent button, right-aligned;
  "Cancel" as a plain text link beside it.

---

## 4. Create wizard — Step 5 of 5 (Generate)

Step 5 of the same wizard (Basics, References, Story, Look, **Generate**
active). Same chrome as screen 3.

Two states:
1. GENERATING — a large full-bleed soft-focus placeholder image (suggesting a
   photograph still developing) with a single thin 1px indeterminate progress
   rule beneath it in accent color, and one calm serif line of status copy
   beneath that — "Developing Kayla's look…" — replacing round 2's terminal
   pipeline log entirely. No monospace, no colored status dots, no
   timestamped lines.
2. SELECTION — serif heading "Which look is Kayla?" and a 2×2 grid of 4
   full-bleed variation photographs, no card chrome, no mono `[VAR-01]` tags
   — a small-caps "1/2/3/4" label beneath each instead. Selected photo is
   marked by a 2px accent border on the image itself. A plain text provider
   credit line (Higgsfield · WaveSpeed) sits bottom-left, small and warm-gray.
Footer: "Back" plain text link, "Finish" the screen's one filled accent
button, enabled once a variation is selected.

---

## 5. Inspiration

Mood-board gallery, editorial photo-studio tool, desktop. Nav as above,
**Inspiration** active.

- Header: serif "Inspiration" title, a small-caps count "1 board · 6 images"
  beneath it, "New Board" as the one filled accent button, top-right.
- Masonry of 4 board cards: each a full-bleed 2×2 photo collage with no card
  border, serif board title overlaid at the bottom on a soft dark scrim only
  (Streetwear, Moody Portraits, Golden Hour), image count as small-caps text.
  Rename / Delete appear as plain text on hover, no icon buttons.
- One board OPEN: a full-screen overlay, plain warm-black scrim (no heavy
  blur), masonry of 6 full-bleed images, serif board title top-left, a plain
  "×" text close top-right.

---

## 6. Brand Deals

Sponsorship CRM, editorial photo-studio tool, desktop. Nav as above, **Brand
Deals** active.

- Header: serif "Brand Deals" title, small-caps summary "3 active · $12.4k
  pipeline" beneath, "New Deal" as the one filled accent button.
- Grid of 4 deal panels, hairline border, no shadow: brand name in serif +
  small wordmark, campaign title beneath in body text ("Summer activewear
  drop"), status as a small-caps text label with a colored dot — not a filled
  pill — (Negotiating amber dot, Active accent dot, Completed green dot,
  Declined warm-gray dot), deliverables as a plain line ("2 posts · 1 story ·
  1 video"), fee in the grotesque ($4,500), due date, assigned influencer as a
  small circular avatar + name. No corner ID tag.
- One panel expanded into a form: Brand input, Campaign input, Fee number
  input, Status select, Deliverables textarea, Influencer select, "Save" as
  the form's one filled accent button.

---

## 7. Character Health

Consistency/quality dashboard, editorial photo-studio tool, desktop. Same nav
as above (reached from Workspace; no tab bar needed).

- Header: serif "Character Health" title, small-caps subtitle "Consistency ·
  Variety · Drift Monitor".
- Grid of 4 character panels: avatar + serif name + niche, then 6 thin 1px
  stat bars — bone track, single-color fill per metric (muted, not neon):
  Total Assets, Outfit Variety, Pose Variety, Location Variety, Content
  Consistency, Face Drift Risk (accent-red fill only when this one is high —
  the one place a second use of the accent color is justified, since it's a
  genuine warning state). Values as small-caps numbers beside each bar
  (e.g. 42/100), not inside it.
- One panel flagged: a small-caps "Drift Alert" label in accent color above
  its name, no glow, no colored border around the whole panel.
- Top-right: "Run scan" as an accent-outlined button (outline, since it isn't
  this screen's single primary action — there isn't one here).

---

## 8. Settings

Editorial photo-studio tool, desktop. Nav as above.

Centered column, max-width 640px, stacked panels with generous vertical gaps
(no glass, hairline borders only), each with a small-caps section header:
1. **Higgsfield** — status as a small-caps "Connected" label + green dot,
   masked account email, "Disconnect" as a plain text link, a warm-gray note
   about media-generation OAuth beneath.
2. **Claude API** — masked key input (`sk-ant-••••••••`), "Save" as the one
   filled accent button in this section, "Remove key" plain text link.
3. **WaveSpeed** — same pattern as Claude API.
4. **FanFlow Backend** — URL input (`http://localhost:11434`), model select
   (hermes3:8b, llama3:8b, phi3:mini), status row — green dot + small-caps
   "Online · 847ms median" — "Test connection" as an accent-outlined button.
5. **Appearance** — a note that this app is dark-only (no light/dark toggle),
   density select.
No corner tags on any section — the small-caps header is the only label
each needs.

---

## 9. Studio landing page

Landing page for "Influencer Studio" (studio mode — FanFlow mode already has
its own landing). Editorial photo-studio tool, desktop, marketing page.

- Nav: serif "Influencer Studio" wordmark, links Features / Characters /
  Pricing in the grotesque, "Open Studio" as the one filled accent button.
- HERO: not the round-2 floating-orbs-behind-a-mockup composition. Instead, a
  large full-bleed editorial fashion photograph fills the right ~60% of the
  viewport, desaturated/filmic grade. Left side on warm black: serif display
  headline "Run your AI influencer like a studio.", a body-text subhead about
  consistent characters, photos, videos, and fan engagement from one tool, and
  two CTAs — "Create your influencer" (the one filled accent button) and
  "Watch demo" (plain text link with an arrow, not a bordered ghost button).
- Stats row beneath, small-caps, plain text separated by hairline rules:
  "∞ characters", "4 providers", "1 tool" — no colored dots.
- Feature grid: 4 panels, hairline border, no icons-in-colored-chips — a small
  serif numeral (01–04) above each title instead: Character Sheet
  consistency, Photo Studio with wardrobe, FanFlow fan CRM with memory, Brand
  Deals pipeline.
- Footer: minimal, small-caps links Privacy / Terms / Status, plain warm-gray
  on warm black.
