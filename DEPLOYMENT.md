# 🚀 Deployment Guide — German A1–C2 WhatsApp Channel Bot

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│           GitHub Actions (free, no server needed)           │
│                                                             │
│   Cron: every day 8:00 AM IST                               │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 1. Restore WhatsApp session (from secret)           │   │
│   │ 2. Call Gemini → generate today's word              │   │
│   │    (level-aware, memory of past words, no repeats)  │   │
│   │ 3. Post to WhatsApp Channel                         │   │
│   │ 4. Commit progress.json back to repo                │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│         DM Bot (npm run bot — run locally or on Railway)    │
│                                                             │
│   When someone DMs your WhatsApp number:                    │
│   ├─ NEW user → asks: "What's your level? A1/A2/.../C2"     │
│   ├─ "more"      → extra word for their level (max 3/day)   │
│   ├─ "flashcard" → Gemini quiz on words they've learned     │
│   ├─ "level"     → change CEFR level                        │
│   └─ "help"      → show commands                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 1 — Before You Start

| # | What you need | Where to get it |
|---|---|---|
| 1 | **Dedicated WhatsApp number** | A spare SIM — do NOT use your personal number |
| 2 | **Gemini API key** (free) | [aistudio.google.com](https://aistudio.google.com) → Get API Key |
| 3 | **GitHub account** | [github.com/signup](https://github.com/signup) |
| 4 | **GitHub Personal Access Token** | See Step 3 below |
| 5 | **Node.js 20+** (one-time, local) | [nodejs.org](https://nodejs.org) |

---

## Part 2 — One-Time Local Setup

### Step 1 — Create your WhatsApp Channel

1. Open WhatsApp on your **dedicated number**
2. Tap **Channels** (megaphone icon) → **"+"** → **"Create channel"**
3. Name it: e.g. `🇩🇪 German Daily Words`
4. After creating → tap channel name → **"Invite via link"**
5. Your link: `https://whatsapp.com/channel/0ABCxyz123456789`
6. **Copy everything after `/channel/`** → that is your `CHANNEL_ID`

---

### Step 2 — Get a free Gemini API Key

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with any Google account
3. Click **"Get API key"** → **"Create API key"**
4. Copy the key (looks like `AIzaSy...`)

> Free tier: **1,500 requests/day** — we use 1 per day. No credit card needed.

---

### Step 3 — Create a GitHub Personal Access Token (PAT)

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **"Generate new token (classic)"**
3. Name: `whatsapp-german-bot`
4. Expiration: **No expiration**
5. Scopes — tick **only**:
   - ✅ `repo` (full repository access)
6. Click **"Generate token"** → **copy it immediately** (shown only once!)

---

### Step 4 — Authenticate WhatsApp (QR scan)

```bash
cd whatsapp-german
npm install
npm run setup
```

A browser window opens. When you see the QR code:
1. Open WhatsApp on your **dedicated number**
2. Go to **Settings → Linked Devices → Link a Device**
3. Scan the QR code
4. Wait for `✅ WhatsApp connected!`

The terminal will then print a **very long base64 string**:

```
══════════════════════════════════════════════
📋 COPY THIS → save as GitHub Secret: WWEBJS_AUTH
══════════════════════════════════════════════
H4sIAAAAAAAAA+2Y32/aMBDH/5WK... (very long)
══════════════════════════════════════════════
```

**Copy the entire string** — you'll need it in Step 6.

---

### Step 5 — Push to GitHub

```bash
git init
git add .
git commit -m "feat: german bot initial setup"
```

On GitHub → [github.com/new](https://github.com/new):
- Name: `whatsapp-german`
- Visibility: **Private** ⚠️ (your session data is sensitive)
- Do NOT add README or .gitignore — keep it empty

```bash
git remote add origin https://github.com/YOUR_USERNAME/whatsapp-german.git
git branch -M main
git push -u origin main
```

---

## Part 3 — GitHub Secrets Setup

> **Settings → Secrets and variables → Actions → New repository secret**

Add all **5 secrets**:

---

### 🔑 Secret 1: `GEMINI_API_KEY`
| | |
|---|---|
| **Name** | `GEMINI_API_KEY` |
| **Value** | Your key from Step 2, e.g. `AIzaSyxxxxxxxxxxxxxxx` |

---

### 🔑 Secret 2: `CHANNEL_ID`
| | |
|---|---|
| **Name** | `CHANNEL_ID` |
| **Value** | The ID from your channel link, e.g. `0ABCxyz123456789` |

---

### 🔑 Secret 3: `CHANNEL_LEVEL`
| | |
|---|---|
| **Name** | `CHANNEL_LEVEL` |
| **Value** | `A1` (or A2/B1/B2/C1/C2 — what level your channel posts at) |

> This is for the **public channel** posts. Individual users who DM the bot pick their own level separately.

---

### 🔑 Secret 4: `WWEBJS_AUTH`
| | |
|---|---|
| **Name** | `WWEBJS_AUTH` |
| **Value** | The long base64 string printed in your terminal during Step 4 |

---

### 🔑 Secret 5: `GH_PAT`
| | |
|---|---|
| **Name** | `GH_PAT` |
| **Value** | Your GitHub Personal Access Token from Step 3, e.g. `ghp_xxxx...` |

---

After adding all 5, your secrets page should look like:

```
Repository secrets
├── CHANNEL_ID          Updated just now
├── CHANNEL_LEVEL       Updated just now
├── GEMINI_API_KEY      Updated just now
├── GH_PAT              Updated just now
└── WWEBJS_AUTH         Updated just now
```

---

## Part 4 — Test & Go Live

### Test the channel poster (GitHub Actions)

1. Go to your repo → **Actions** tab
2. Click **"🇩🇪 German Word of the Day"** in the left sidebar
3. Click **"Run workflow"** → **"Run workflow"** (green button)
4. Watch the logs — you should see a post appear in your WhatsApp Channel!

You can also override the level for a single run:
- Click **"Run workflow"** → type `B1` in the level field → run

---

### Run the DM bot locally (interactive features)

```bash
npm run bot
```

Now DM your WhatsApp number from any phone. The bot will:
1. Ask you to pick your level (A1–C2)
2. Respond to `more`, `flashcard`, `level`, `help`

---

## Part 5 — Schedule & Commands Reference

### GitHub Actions schedule
Runs automatically at **8:00 AM IST** (02:30 UTC) every day.

To change: edit `.github/workflows/daily-word.yml` line 6:
```yaml
- cron: '30 2 * * *'   # UTC: minute hour * * *
```
Use [crontab.guru](https://crontab.guru) to build the expression.

---

### DM Bot commands (for followers who message your number)

| Command | What it does |
|---|---|
| _(first message)_ | Triggers welcome + level picker |
| `more` | Extra word at their level (max 3/day) |
| `flashcard` | Gemini quiz on past words (smart — targets weak spots) |
| `level` | Change CEFR level (A1–C2), history is preserved |
| `help` | Show all commands |

---

## Part 6 — Troubleshooting

| Problem | Fix |
|---|---|
| "CHANNEL_ID is not set" | Check `CHANNEL_ID` secret in GitHub → Settings → Secrets |
| "GEMINI_API_KEY is not set" | Check `GEMINI_API_KEY` secret |
| "Auth failure" / session expired | Re-run `npm run setup` locally → copy new base64 → update `WWEBJS_AUTH` secret |
| Workflow fails on Chromium step | Ubuntu dependency issue — check the Actions log for which apt package is missing |
| Bot posts wrong level | Check `CHANNEL_LEVEL` secret; or set it manually on the "Run workflow" popup |
| DM bot doesn't respond | Make sure `npm run bot` is running and the same WhatsApp number is linked |
| Workflow doesn't run on schedule | GitHub can delay cron by up to 30 min. Test with "Run workflow" button first |
