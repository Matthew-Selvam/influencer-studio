# Handoff — 2026-08-28

## Live right now

**Workspace preview (merged Influencers + FanFlow tabs):**
https://ai-influencer-git-redesign-stit-e94ff4-matthew-selvams-projects.vercel.app

Built from `redesign/stitch-revamp` @ `b25785a`, state READY. Production is
untouched — still `main` @ `b3e994a`.

## ⚠ Vercel projects are crosswired — read before deploying

| Vercel project | Builds from GitHub repo | Domain |
|---|---|---|
| `ai-influencer` (`prj_Kkrqj31EB39t6sweJ9M7b3oO8NuS`) | **`influencer-studio`** ← this repo | ai-influencer-roan.vercel.app |
| `fan-flow` (`prj_QDGllQHiXzQsEW3yOMYs0jDAprIm`) | **`FanFlow`** ← a *different* repo | fan-flow-five.vercel.app |

Two traps:

1. **Local `.vercel/project.json` points at `fan-flow`**, which does NOT build
   this repo. Recent `fan-flow` deployments carry `gitDirty: "1"` — they were
   manual `vercel` CLI deploys from this folder, which is why they show this
   repo's commit messages on a project linked elsewhere. **Running `vercel` in
   this directory deploys to the wrong project.**
2. GitHub repo was renamed `ai-influencer` → `influencer-studio`. Vercel still
   stores the old name in deployment metadata. Same repo; the redirect works.

**Decision made but NOT executed:** retire the second domain. The Workspace merge
only unifies the roster for users on a *single origin* (localStorage is
per-origin), so keeping both domains live defeats the point. Pick
`ai-influencer-roan` as canonical and redirect `fan-flow-five` to it.

## Branches

| Branch | Commits | State |
|---|---|---|
| `main` | — | in sync with origin, production |
| `redesign/stitch-revamp` | 2 | **pushed**, preview deployed |
| `feat/hermes3-sampling` | 3 | **local only, never pushed** |

### `redesign/stitch-revamp` — Workspace merge
- `src/pages/Workspace.jsx` (new) hosts Influencers + FanFlow as tabs; URL drives
  the active tab so `/influencers` and `/fanflow` still deep-link.
- Both tabs stay mounted (inactive `display:none`) so state survives switching.
- New `--shell-top` CSS var: Influencers is `position:fixed`, FanFlow is in-flow;
  both offset from the same var so the tab bar clears both.
- Nav collapsed to one "Workspace" entry; **removed the cross-deployment link**.
- Docs added: `REDESIGN_BASELINE.md` (96-component inventory + verification
  checklist), `DATA_LAYER.md` (what "same DB" does and doesn't mean).

### `feat/hermes3-sampling` — LLM quality/latency
- `hermes3:8b` default; sampling wired to Ollama: temp 0.9, min_p 0.07,
  repeat_penalty 1.04, num_predict 350, `num_ctx: 8192`, ChatML stop list.
- **`num_ctx` was never sent before** → Ollama's small default truncated the
  prompt from the left, silently eating persona + memory. Biggest fix here.
- `keep_alive: 30m` — cold load was 9.2s vs ~1.5s warm.
- Few-shot example dialogues, parsing **SillyTavern `mes_example`** directly
  (`<START>` blocks, `{{user}}`/`{{char}}`), injected as real chat turns.
- Fixed: `handleMessage` defaults `model = null`, and JS default params only fire
  on `undefined` — so `config.model` was unreachable and Ollama 400'd.

**Measured warm:** 837ms / 1150ms / 1375ms. Backstory detail (shellfish allergy,
buried at the end) now honored unprompted — direct evidence the num_ctx fix landed.

## Open decisions (blocking)

1. **AI-disclosure guardrail.** `fanflow/src/persona.js:23` hardcodes *"never
   claim to be a real person."* Fights immersive roleplay; ST card format has no
   slot for it so imports bypass it. **Deliberately left untouched** — it's a
   disclosure guardrail on a system talking to paying fans, not a tuning knob.
   Needs an explicit call.
2. **Streaming (Phase 2) not started.** Touches `FanFlow.jsx`, which
   `redesign/stitch-revamp` also rewrites — doing both guarantees a conflict.
   Decide whether the Workspace merge lands first. Less urgent than planned: at
   1.4s full replies there's little dead air to hide.
3. **Second domain retirement** — decided, not executed (see above).

## Next steps, in order

1. Review the preview URL; merge `redesign/stitch-revamp` → `main` if good.
2. Push `feat/hermes3-sampling` (never pushed). Note: Vercel has no Ollama, so
   the LLM changes only take effect against a reachable backend — see below.
3. **Phase 7 (highest value):** FanFlow memory does not survive on Vercel at all.
   `memoryBackend` defaults to `'file'`, writing to a read-only deployment dir;
   `writeStore()` catches and logs `[fanflow] memory persist failed`. Every cold
   start drops all fan memory. `config.js:27` already says "Swappable for pgvector
   later." Put Postgres + pgvector on the old HP as an always-on box, expose via
   Cloudflare Tunnel (HTTPS — an HTTPS page can't call `http://localhost`).
4. Then Phase 5 (real LLM auto-summary — current "episodic summary" is a 600-char
   transcript concat, no LLM), Phase 4 (lorebooks), Phase 6 (TTS — Piper, not
   Chatterbox on the HP; no CUDA/ROCm path on 2018 AMD integrated).

## Hardware notes

- Dev machine: MacBook Air M4, 16GB. Runs `hermes3:8b` at ~20 tok/s. Keeps model
  warm 30m via `keep_alive`.
- Old HP (2018, AMD integrated, 16GB): **cannot** usefully run 8B (~2-4 tok/s).
  Best role is always-on Postgres + Piper TTS + small summarizer model.

## Plan file

`/Users/matthewselvam/.claude/plans/im-also-going-to-parsed-penguin.md` — full
7-phase plan with reasoning, latency budget, and verification steps.

## Not done / caveats

- **Stitch redesign never happened.** The MCP is connected but the visual revamp
  was never started — the branch name `redesign/stitch-revamp` is aspirational.
  It currently contains only the tab merge, not any Stitch-generated design.
- `GOOG_API_KEY` is in `~/.zshenv` and `launchctl setenv`. The Stitch MCP header
  uses `${GOOG_API_KEY}`. Earlier it silently failed as literal `$GOOG_API_KEY`
  (unbraced) and as an unset var — verify with
  `claude mcp list` showing no "Missing environment variables" warning.
- Full-app regression against `REDESIGN_BASELINE.md` has **not** been run since
  the Workspace merge (both site modes × both themes).
