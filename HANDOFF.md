# Handoff — 2026-08-28, late

This consolidates work from two sources that ran on this repo today: a Claude
Code session (this one) and a parallel opencode session that picked up the
first handoff and continued autonomously. Written after reconciling both
against real repo/Vercel state — not from either transcript's own narration.

## Live right now

**Production** (`ai-influencer-roan.vercel.app`): `main` @ `b25785a`, the
Workspace merge (Influencers + FanFlow as one tabbed page). Confirmed via
Vercel's own deployment record — `dpl_HHJe9tE62mM8ob1QZbE223GSB3AY`, target
`production`, state `READY`.

**Preview** (`feat/hermes3-sampling`, not merged):
https://ai-influencer-git-feat-hermes3-1f5447-matthew-selvams-projects.vercel.app
Builds fine but its LLM changes are inert there — no Ollama on Vercel.

## Branches

| Branch | Head | Merged to main? |
|---|---|---|
| `main` | `b25785a` | — |
| `redesign/stitch-revamp` | `b25785a` (same commit) | yes, already merged |
| `feat/hermes3-sampling` | `305b524` | no — needs a deliberate call, see below |

## What's actually done

**Workspace merge** (`redesign/stitch-revamp` → `main`, live in production):
`Workspace.jsx` hosts Influencers + FanFlow as tabs on one origin, unifying the
influencer roster (localStorage is per-origin, so two separate deployments
could never share it). Both tabs stay mounted across switches. New
`--shell-top` CSS var lets Influencers' fixed pane and FanFlow's in-flow layout
share one offset. See `REDESIGN_BASELINE.md` (96-component inventory,
verification checklist) and `DATA_LAYER.md` (what "same DB" does/doesn't mean
— short version: roster is unified, FanFlow memory still isn't durable
anywhere).

**LLM quality/latency** (`feat/hermes3-sampling`, preview only):
- `hermes3:8b` default, sampling wired to Ollama (temp 0.9, min_p 0.07,
  repeat_penalty 1.04, num_predict 350, **num_ctx 8192** — this was the real
  fix, Ollama's small default was silently truncating persona+memory from the
  left), ChatML stop sequences, `keep_alive: 30m` (cold load was 9.2s vs
  ~1.5s warm). Measured warm: 837/1150/1375ms.
- Few-shot example dialogues — parses SillyTavern `mes_example` format
  directly (`<START>` blocks, `{{user}}`/`{{char}}` macros), injected as real
  chat turns rather than prompt prose.
- Fixed a real bug: `handleMessage` defaults `model` to `null`, and JS default
  params only fire on `undefined` — so the configured model was unreachable
  through that path and Ollama 400'd. Masked in production because the router
  always supplied a value.

**AI-disclosure guardrail — resolved** (commit `305b524`, done by the
opencode session, reviewed here and judged sound): split into two concerns.
Proactive disclosure moved to the UI layer (FanFlow.jsx already labels the
character "fictional AI character"), since a prompt instruction was the
weaker place for it and it was firing mid-roleplay. "Never claim to be human"
kept and reinforced — measured against hermes3:8b through 3 wording rounds;
even the best prompt-only wording still denied being AI on a later run of the
same probe ("No, I'm not a chatbot! I'm actually Camila, a real person"), so a
**deterministic backstop** (`fanflow/src/disclosure.js`) now inspects every
reply and repairs a denial: retry once with a correction turn, then substitute
a fixed honest line if it denies again. Never ships a denial, including when
the retry itself fails. 27 hermetic unit tests (`npm test`) plus 4 opt-in live
tests against real Ollama (`npm run test:live`) — latest live run: prompt
layer 0/12 denied, 1/12 evaded; guarded 0/12 survived. This is the first test
suite in the project.

## Stitch redesign — round 3 in progress

**Round 1** never happened (branch name `redesign/stitch-revamp` is
aspirational — it contains only the Workspace merge, no Stitch-generated
design).

**Round 2** ("Synthetic Command" — dark glassmorphic neon command-center OS)
was drafted as `docs/STITCH_PROMPTS.md`, 9 screen prompts, Stitch project
"FanFlow — AI Creator OS" (`projects/17753558777913679175`). 4 screens were
actually generated in Stitch under this design system (FanFlow Landing ×2,
FanFlow Dashboard ×2 — the FanFlow tab, not Workspace). User called it "ass"
and asked for a redo choosing aesthetics independently, keeping every
component/feature. The session reasoning that new direction got aborted
mid-response (token/rate limit) before writing anything.

**Round 3** ("Atelier" — editorial photo-studio look: warm dark tones instead
of cold neon-glass, no gradients/glow, one restrained muted accent color
reserved for primary actions, serif display type + grotesque body instead of
monospace terminal IDs, full-bleed photography instead of small bordered
thumbnails) is now written to `docs/STITCH_PROMPTS.md` — **not yet
committed**, and **not yet generated in Stitch**. Same 9 screens, same every
field/card/count as round 2, restyled only. The 4 already-generated Synthetic
Command screens are explicitly out of scope for this round (FanFlow tab, not
part of the "ass" complaint) — regenerate separately if Atelier is approved
for those too.

**Blocked:** the Stitch MCP's auth is broken here — `list_screens` /
`list_design_systems` both fail with "Incompatible auth server: does not
support dynamic client registration." Ground truth on what's actually in the
Stitch project came from the prompts file and prior session transcript, not a
live check. Fixing that auth is a prerequisite to generating round 3 or
verifying round 2's actual state.

## Open decisions

1. **Merge `feat/hermes3-sampling`?** Contains real, tested, safety-relevant
   work (the disclosure guard). Not merged yet — needs an explicit call, and
   note it's inert on Vercel without a reachable Ollama regardless.
2. **Approve the Atelier direction** before spending Stitch generations on it.
3. **Fix Stitch MCP auth** — needed either way to actually generate screens or
   verify round 2's state.
4. **Retire the second Vercel domain** (`fan-flow-five.vercel.app`) — decided
   earlier, not executed. The Workspace merge only delivers a shared roster on
   whichever single origin people actually use.

## Next steps, in order

1. Review round 3 prompts (`docs/STITCH_PROMPTS.md`) here or fix Stitch auth
   and generate them directly.
2. Decide on `feat/hermes3-sampling` merge.
3. **Phase 7 (highest remaining value):** FanFlow memory has no durable store
   on Vercel at all — `memoryBackend` defaults to `file`, writing to a
   read-only deployment dir; every cold start drops all fan memory.
   `config.js` already anticipates "swappable for pgvector later." Old HP
   (2018, AMD integrated, 16GB) is the right box for this — can't usefully run
   an 8B model (~2-4 tok/s) but is fine as an always-on Postgres+pgvector
   server, exposed via Cloudflare Tunnel for HTTPS.
4. Then real LLM auto-summary (current "episodic summary" is a 600-char
   transcript concat, no LLM involved), lorebooks, Piper TTS (not Chatterbox
   on the HP — no CUDA/ROCm path on 2018 AMD integrated graphics).

## Plan file

`/Users/matthewselvam/.claude/plans/im-also-going-to-parsed-penguin.md` — full
7-phase plan, latency budget, verification steps for the LLM work.
