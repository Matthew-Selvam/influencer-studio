# Data layer — what "same DB" means after the merge

Written while merging Influencers + FanFlow onto one Workspace page.
Short version: **the merge genuinely unified one of the two data sets. The other
has no durable store at all on Vercel, and that predates this change.**

## 1. Influencer roster — unified by the merge ✅

`src/store.jsx` keeps influencers in **browser localStorage**, one key per
influencer (`hf_influencer_<id>`) plus an ordered `influencer_ids` list.

localStorage is scoped **per origin**. Before the merge:

| Origin | Saw |
|---|---|
| `ai-influencer-roan.vercel.app` | its own roster |
| `fan-flow-five.vercel.app` | a completely separate, empty roster |

They could never see each other's influencers — not a sync bug, just two origins.

Serving both tabs from **one origin** is what fixes this, and it is now fixed:
FanFlow's persona strip reads the same roster the Influencers tab writes.
Verified — the strip lists Camila / Kayla / Brad / Olivia / Derek / Joshua /
Jake / Marcus, straight from the Influencers tab.

**Caveat:** this is still localStorage, not a database. It is per-browser and
per-device. Two people, or one person on phone + laptop, still see different
rosters. There is no server-side copy and no cross-device sync.

## 2. FanFlow memory — no durable store on Vercel ❌

`fanflow/src/memory.js` holds fans, episodic memory, and events. Two backends,
selected by `FANFLOW_MEMORY_BACKEND` (`fanflow/src/config.js:28`):

- `file` (**the default**) — atomic tmp+rename write to `<dataDir>/memory.json`
- `memory` — pure in-memory, `persist()` is a no-op

Neither is durable on Vercel:

- The `file` default writes into the deployment directory, which is **read-only**
  on Vercel. `writeStore()` catches the failure and logs
  `[fanflow] memory persist failed: …`, so it degrades to in-memory but noisy.
- Even `/tmp` (the one writable path) does not survive between invocations and
  is not shared across concurrent instances.
- The `memory` backend is explicitly in-memory by design — the code comments
  already call this out: *"Vercel serverless: the FS is ephemeral"*.

**Net effect on Vercel: every cold start loses all fan memory, relationships,
and events.** That is true today on the live FanFlow deployment, independent of
this merge.

## What this means for "both tabs on the same DB"

The merge delivers the shared **roster**. It does not create a database, because
there isn't one to connect to yet. To get real shared persistence, pick a store
and add a third memory backend beside `file` and `memory`:

| Option | Fits | Notes |
|---|---|---|
| **Vercel KV / Upstash Redis** | closest to the current shape | `memory.js` already reads/writes one JSON blob — a KV get/set is close to a drop-in third backend |
| **Vercel Postgres / Neon** | proper relational | best if influencers also move server-side; more schema work |
| **Supabase** | Postgres + auth + storage | most to adopt, most to gain if multi-user is coming |

Whichever is chosen, the influencer roster should move off localStorage at the
same time — otherwise FanFlow memory becomes durable and multi-device while the
roster it references stays trapped in one browser.

## Local LLM via port — already supported

No work needed. `src/utils/fanflow.js` resolves its base URL from the
`fanflow_url` localStorage key, overridable in **Settings**. Leave it empty for
same-origin `/api/fanflow`, or point it at e.g. `http://localhost:8787` to hit a
local server. The client already allows a 120s timeout for slow local first-token.

Note the browser-vs-server split: if the deployed page is HTTPS, it cannot call a
plain `http://localhost` backend without a mixed-content exception — the local
LLM path works when the page itself is served locally, or through a tunnel.
