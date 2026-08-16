# WhatsApp German Word Channel

Posts one AI-generated German vocabulary word (CEFR A1 by default) to a WhatsApp Channel every morning — fully automated, fully free to run.

If you would like to read the pain of architecting this, do check out my [Medium article](https://medium.com/@btkcodedev/i-just-wanted-a-whatsapp-channel-that-teaches-me-one-german-word-a-day-1f6ec3a56278): 

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  GitHub Actions (cron, daily)                              │
│                                                            │
│  1. Checkout repo (fresh runner, no persistent disk)       │
│  2. npm start → src/index.ts                               │
│       - Load WhatsApp session from MongoDB (Baileys)       │
│       - Ask Gemini for today's word (CEFR-aware)           │
│       - Post it to the WhatsApp Channel                    │
│       - Save updated progress back to MongoDB              │
│  3. Runner is destroyed — nothing persists locally         │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
                 MongoDB Atlas (free M0)
          - WhatsApp session (a few KB of creds)
          - Channel progress (current day, words used)
```

No server to keep running, no Docker image, no Render/Railway hosting. The job takes about a minute a day.

## Tech Stack

- **Runtime**: Node.js 20 + TypeScript (`tsx`)
- **WhatsApp**: [Baileys](https://github.com/WhiskeySockets/Baileys) — talks the WhatsApp multi-device protocol directly over WebSocket, no headless Chromium
- **AI**: Google Gemini, Flash family — tries `gemini-3.7-flash` first and falls back through older Flash models if one is retired or overloaded (see `MODEL_FALLBACKS` in `src/vocabulary.ts`)
- **Session + progress storage**: MongoDB Atlas free tier (Mongoose)
- **Scheduling**: GitHub Actions cron (free)

## Prerequisites

1. **Dedicated WhatsApp number** (don't use your personal one — automation risks a ban)
2. **Google Gemini API key** — free at [aistudio.google.com](https://aistudio.google.com/app/apikey)
3. **MongoDB Atlas free cluster (M0)** — free forever at [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)
4. **Node.js 20+** for the one-time local link step

## Setup

### 1. Install

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/whatsapp-german
CHANNEL_ID=your_channel_invite_code_here
CHANNEL_LEVEL=A1
```

### 2. Create the WhatsApp Channel

1. WhatsApp → Channels → "+" → "Create channel", name it (e.g. "German Daily Words")
2. Channel name → "Invite via link" → copy the code from `https://whatsapp.com/channel/XXXXXXXXXX`
3. That `XXXXXXXXXX` is your `CHANNEL_ID`

### 3. Link WhatsApp — one time only

```bash
npm run link
```

Scan the QR with your dedicated number (Settings → Linked Devices → Link Device). Once it prints "Linked!", stop it (`Ctrl+C`) — the session is now saved in MongoDB and this step never needs repeating unless the session later gets invalidated (WhatsApp logout, phone offline 14+ days, etc.).

### 4. Deploy the daily job

Add three **GitHub Actions secrets** (repo → Settings → Secrets and variables → Actions):

- `GEMINI_API_KEY`
- `MONGODB_URI` — the **same** URI you used in step 3
- `CHANNEL_ID`

Push. [.github/workflows/daily-word.yml](.github/workflows/daily-word.yml) runs daily at 8:00 AM IST, and can also be triggered manually from the Actions tab (`workflow_dispatch`).

## If the session ever expires

WhatsApp can invalidate a linked session (logout, ~14 days phone-offline, device-limit). When it does, the workflow run fails with a clear message telling you to re-run `npm run link` locally. There's no way around a live phone re-scan when this happens — it's inherent to riding on WhatsApp's personal-account protocol rather than an official bot API.

## CEFR Levels & Topics

Change `CHANNEL_LEVEL` in `.env` / the workflow secret to any of `A1` `A2` `B1` `B2` `C1` `C2`. Topics rotate automatically and Gemini is given the list of already-used words so it never repeats one for this channel.

## Key Files

- `src/index.ts` — the daily job: generate word → connect → post → save progress
- `src/link.ts` — one-time local QR link
- `src/waAuth.ts` — MongoDB-backed Baileys session storage
- `src/db.ts` — Mongo connection, channel progress, session storage schemas
- `src/vocabulary.ts` — Gemini prompt, model-fallback chain, word formatting

## Security Notes

- Never commit `.env` — it's gitignored
- The WhatsApp session lives only in your MongoDB cluster and GitHub Actions secrets, never in the repo
- Use a dedicated WhatsApp number, not your personal one

## Troubleshooting

| Problem | Cause / fix |
|---|---|
| `MONGODB_URI is not set` | Add it to `.env` locally or as a GitHub Actions secret |
| `No linked WhatsApp session found in MongoDB` | Run `npm run link` locally (with the same `MONGODB_URI`) |
| `Session was logged out` | Re-run `npm run link` to re-scan |
| `models/... is not found` | Every entry in `MODEL_FALLBACKS` (src/vocabulary.ts) is dead — check current free-tier model IDs at ai.google.dev and update the list |
| Workflow doesn't fire on schedule | GitHub Actions cron can lag up to ~15 min on free runners, or the repo went inactive — trigger manually via Actions tab to confirm the job itself works |

---

Built for German language learners.
