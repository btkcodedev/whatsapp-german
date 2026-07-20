# 🚀 Deployment Guide — German A1 WhatsApp Channel Bot

## Overview

This bot runs **100% free** on GitHub Actions. There is no server. Every morning GitHub's cloud runs the script, generates a German word via Gemini AI, and posts it to your WhatsApp Channel automatically.

---

## What You Need Before Starting

| # | Requirement | Where to get it |
|---|---|---|
| 1 | A **dedicated WhatsApp number** | A spare SIM or a number you don't use personally |
| 2 | A **Gemini API key** | [aistudio.google.com](https://aistudio.google.com) → "Get API Key" |
| 3 | A **GitHub account** | [github.com/signup](https://github.com/signup) |
| 4 | A **GitHub Personal Access Token** | See Step 4 below |
| 5 | Node.js installed on your laptop (one-time only) | [nodejs.org](https://nodejs.org) |

---

## Step 1 — Create Your WhatsApp Channel

> Do this on your **dedicated WhatsApp number**, not your personal one.

1. Open WhatsApp on that number
2. Tap the **Channels** tab (megaphone icon at the bottom)
3. Tap **"+"** → **"Create channel"**
4. Give it a name: e.g. `🇩🇪 German A1 Daily`
5. After creating, tap the channel name at the top → **"Invite via link"**
6. Your link will look like:
   ```
   https://whatsapp.com/channel/0ABCxyz123456789
   ```
7. **Copy the part after `/channel/`** — that is your `CHANNEL_ID`:
   ```
   0ABCxyz123456789
   ```
   Save this. You'll need it soon.

---

## Step 2 — Get Your Gemini API Key (Free)

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with any Google account
3. Click **"Get API key"** in the top left
4. Click **"Create API key"** → select any project
5. Copy the key (looks like `AIzaSy...`)

> ✅ The free tier gives you **1,500 requests/day** — we use 1 per day. No credit card needed.

---

## Step 3 — One-Time Local Setup (Scan QR Code)

This step runs **once on your laptop** to link the bot to your WhatsApp account. After this, GitHub Actions takes over forever.

```bash
# In the project folder:
npm install
npm run setup
```

A **browser window will open** showing a QR code.

1. Open WhatsApp on your dedicated number
2. Go to **Settings → Linked Devices → Link a Device**
3. Scan the QR code
4. Wait for it to say **"✅ WhatsApp connected!"**

The script will then print a **long block of text** like this in your terminal:

```
══════════════════════════════════════════════════════════════
📋 COPY THIS BASE64 STRING AND SAVE IT AS GITHUB SECRET: WWEBJS_AUTH
══════════════════════════════════════════════════════════════
H4sIAAAAAAAAA+2Y32/aMBDH/5WK... (very long string)
══════════════════════════════════════════════════════════════
```

**Copy that entire string.** You'll need it in Step 5.

---

## Step 4 — Create a GitHub Personal Access Token (PAT)

The bot needs to write `progress.json` back to your repo after each post.

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **"Generate new token (classic)"**
3. Give it a name: `whatsapp-german-bot`
4. Set expiration: **No expiration** (or 1 year if you prefer)
5. Under **Scopes**, tick only:
   - ✅ `repo` (full control of private repositories)
6. Click **"Generate token"**
7. **Copy the token** (looks like `ghp_xxxxxxxxxxxx`) — GitHub shows it only once!

---

## Step 5 — Push the Code to GitHub

```bash
# In the project folder:
git init
git add .
git commit -m "feat: initial german bot setup"
```

Now create a new **empty** repository on GitHub:
1. Go to [github.com/new](https://github.com/new)
2. Name it `whatsapp-german`
3. Make it **Private** (recommended — your session data is sensitive)
4. Do **NOT** check "Add README" or any other file — keep it empty
5. Copy the repo URL (e.g. `https://github.com/YOUR_USERNAME/whatsapp-german.git`)

Then push:
```bash
git remote add origin https://github.com/YOUR_USERNAME/whatsapp-german.git
git branch -M main
git push -u origin main
```

---

## Step 6 — Add Secrets to GitHub

> This is where all your tokens go. GitHub encrypts them so they're never visible again.

Go to your repo on GitHub → **Settings** → **Secrets and variables** → **Actions** → **"New repository secret"**

Add these **4 secrets** one by one:

---

### Secret 1: `GEMINI_API_KEY`
| Field | Value |
|---|---|
| **Name** | `GEMINI_API_KEY` |
| **Secret** | Your Gemini API key from Step 2 (e.g. `AIzaSy...`) |

---

### Secret 2: `CHANNEL_ID`
| Field | Value |
|---|---|
| **Name** | `CHANNEL_ID` |
| **Secret** | Your WhatsApp Channel ID from Step 1 (e.g. `0ABCxyz123456789`) |

---

### Secret 3: `WWEBJS_AUTH`
| Field | Value |
|---|---|
| **Name** | `WWEBJS_AUTH` |
| **Secret** | The long base64 string printed in your terminal during Step 3 |

---

### Secret 4: `GH_PAT`
| Field | Value |
|---|---|
| **Name** | `GH_PAT` |
| **Secret** | Your GitHub Personal Access Token from Step 4 (e.g. `ghp_xxxx...`) |

---

After adding all 4, your secrets page should look like this:

```
Repository secrets
├── CHANNEL_ID          Updated just now
├── GEMINI_API_KEY      Updated just now
├── GH_PAT              Updated just now
└── WWEBJS_AUTH         Updated just now
```

---

## Step 7 — Test It Manually

Don't wait until 8 AM. Trigger it right now:

1. Go to your repo on GitHub
2. Click the **"Actions"** tab
3. Click **"🇩🇪 German Word of the Day"** in the left sidebar
4. Click **"Run workflow"** → **"Run workflow"** (green button)
5. Watch the logs — it should post a word to your channel!

If it fails, click the failed run → click **"post-word"** → read the log to see what went wrong.

---

## Schedule

The bot runs automatically at:

| Time | Timezone |
|---|---|
| 8:00 AM | IST (India Standard Time) |
| 2:30 AM | UTC |

To change the time, edit `.github/workflows/daily-word.yml` line 6:
```yaml
- cron: '30 2 * * *'   # ← change this (UTC time, format: minute hour * * *)
```

Use [crontab.guru](https://crontab.guru) to build your cron expression.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "CHANNEL_ID is not set" | Check the `CHANNEL_ID` secret in GitHub Settings → Secrets |
| "GEMINI_API_KEY is not set" | Check the `GEMINI_API_KEY` secret |
| "Authentication failed" | Your WhatsApp session expired. Re-run `npm run setup` locally, copy the new base64, update `WWEBJS_AUTH` secret |
| Bot doesn't post but logs show success | Make sure the WhatsApp number that owns the channel is the same one you scanned with |
| Workflow doesn't run at schedule | GitHub can delay scheduled workflows by up to 30 min. Use "Run workflow" manually to test |
