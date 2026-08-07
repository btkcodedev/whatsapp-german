# 🚀 Complete Setup Guide - WhatsApp German Bot

## ⚠️ IMPORTANT: Session Management Strategy

**GitHub Secrets have a 64KB limit. WhatsApp sessions are 100-500KB+. WE DON'T USE BASE64 IN SECRETS!**

## 📋 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   GitHub Actions                            │
│           (Channel Posts - No Session Needed!)              │
│                                                             │
│  Uses: GitHub-hosted runners (ephemeral)                    │
│  Auth: Fresh QR scan each run via GitHub Codespaces        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Render.com                              │
│              (DM Bot - Persistent Session)                  │
│                                                             │
│  Uses: Persistent disk volume                               │
│  Auth: One-time QR scan in Render Shell                     │
│  Session: Lives on disk, survives restarts                  │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Two Deployment Paths

### Path A: GitHub Actions (Channel Only)

**Best for**: Daily channel posts without user interaction

**How it works**: GitHub Actions runs fresh each time, scans QR via Codespaces

**Setup**:
1. No session storage needed
2. Each run uses GitHub Codespaces browser
3. Scan QR manually when workflow runs
4. Session discarded after post

**Limitations**: Not practical for 24/7 DM bot

---

### Path B: Render.com (DM Bot - RECOMMENDED)

**Best for**: 24/7 interactive DM bot with persistent sessions

**How it works**: Session lives on Render's persistent disk

## 🚀 Render Deployment (RECOMMENDED)

### Step 1: Initial Setup

```bash
# Local machine
git clone <your-repo>
cd whatsapp-german
npm install
cp .env.example .env
```

Edit `.env`:
```env
GEMINI_API_KEY=your_key_here
# NO WWEBJS_AUTH needed!
```

### Step 2: Deploy to Render

1. **Connect Repository** to Render
2. **Configure Service**:
   - Name: `whatsapp-german-bot`
   - Environment: `Docker`
   - Plan: `Starter` ($7/month with persistent disk)

3. **Add Persistent Disk** (CRITICAL):
   ```
   Name: whatsapp-auth
   Mount Path: /app/.wwebjs_auth
   Size: 1 GB
   ```

4. **Environment Variables**:
   ```
   NODE_ENV=production
   GEMINI_API_KEY=your_key_here
   ```

5. **Deploy**

### Step 3: One-Time QR Scan

```bash
# Connect to Render Shell (Dashboard → Shell tab)
cd /app
npm run setup
```

**In the Shell**:
1. Browser window opens with QR code
2. Scan with your WhatsApp number
3. Session saves to `/app/.wwebjs_auth` (persistent disk)
4. Close shell

✅ **Done!** Session persists forever on disk.

### Step 4: Verify

```bash
# Check health
curl https://your-app.onrender.com/health
```

## 🔄 When Session Expires (Every 2-4 weeks)

### Option 1: Render Shell (Easiest)
```bash
# In Render Dashboard → Shell
rm -rf .wwebjs_auth
npm run reauth
# Scan new QR code
```

### Option 2: Redeploy with Manual Trigger
```bash
# In Render Dashboard
# Manual Deploy → Clear cache → Deploy
# Then connect to Shell and run setup
```

## 📅 GitHub Actions (Optional - Channel Posts)

### What About GitHub Actions?

**Problem**: Can't store session in secrets (too large)

**Solutions**:

#### Solution A: Skip GitHub Actions
Just use Render for everything (bot can post to channel too)

#### Solution B: Self-Hosted Runner
```yaml
# .github/workflows/daily-word.yml
jobs:
  post-daily-word:
    runs-on: self-hosted  # Your VPS with session
```

#### Solution C: Manual Channel Posts
Run locally on schedule:
```bash
# Add to your cron
0 8 * * * cd /path/to/whatsapp-german && npm run start
```

## 🎯 Recommended Final Setup

### For Most Users:
1. **Render only** - handles everything
2. Session on persistent disk
3. Re-auth every few weeks via Render Shell

### For Power Users:
1. **Render** - DM bot (persistent)
2. **VPS** - Channel posts (cron)
3. Both share same WhatsApp number
4. VPS has session file, runs setup once

## 🔧 Maintenance

### Monthly Health Check
```bash
npm run check
```

### Re-authentication Signs
- Bot stops responding
- "Auth failure" in Render logs
- Health check fails

### Re-auth Process
1. Render Dashboard → Shell
2. `rm -rf .wwebjs_auth`
3. `npm run reauth`
4. Scan QR
5. Done!

## � Pro Tips

1. **Use a dedicated phone** - Don't use personal WhatsApp
2. **Monitor weekly** - Set up `npm run check` cron job
3. **Backup nothing** - Session on disk is source of truth
4. **Document your Render URL** - You'll need it for health checks
5. **Keep the phone accessible** - You'll need it for re-auth

## 🆘 Troubleshooting

### "Session not found"
→ Run setup in Render Shell

### "Auth failure" after deploy
→ Persistent disk not mounted, check render.yaml

### Bot works but stops after restart
→ Disk mount path wrong, should be `/app/.wwebjs_auth`

### GitHub Actions asking for WWEBJS_AUTH
→ Don't use GitHub Actions for bot, use Render only

### Session expires too often
→ Normal if bot has low activity, re-auth is part of maintenance

## 📝 Quick Reference

```bash
# Local development
npm run setup      # First time QR scan
npm run bot        # Run bot locally
npm run reauth     # Generate new session

# Render Shell commands
npm run setup      # First time on Render
npm run reauth     # When session expires
npm run check      # Health check

# Monitoring
curl https://your-app.onrender.com/health
```

## ✅ Success Checklist

- [ ] Render service deployed
- [ ] Persistent disk mounted to `/app/.wwebjs_auth`
- [ ] Environment variables set (GEMINI_API_KEY)
- [ ] Setup run in Render Shell
- [ ] QR code scanned
- [ ] Health check returns 200 OK
- [ ] Bot responds to DMs
- [ ] Saved Render URL for monitoring

---

**Questions? Check Render logs first, then refer to troubleshooting section above.**