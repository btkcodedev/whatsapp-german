# 🚀 Quick Start Guide

## The Problem We Solved

❌ **Old approach**: Store 43MB session in environment variables  
✅ **New approach**: Store session on persistent disk

No env var size limits, one deployment for everything!

---

## ⚡ Fast Track Setup (Railway - Recommended)

### 1. Prerequisites
- Dedicated WhatsApp number (don't use personal)
- Google Gemini API key ([get free key](https://aistudio.google.com))
- GitHub account

### 2. Get Your API Key
1. Go to [aistudio.google.com](https://aistudio.google.com/app/apikey)
2. Click "Create API key"
3. Copy it (looks like: `AIzaSy...`)

### 3. Create WhatsApp Channel (Optional)
1. Open WhatsApp → Channels → "+" → "Create channel"
2. Name it (e.g., "🇩🇪 German Daily Words")
3. Get invite link → Copy ID after `/channel/`

### 4. Deploy to Railway
```bash
# Push your code
git add .
git commit -m "Ready to deploy"
git push
```

1. Go to [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub"
3. Select this repo
4. Wait for first deploy (will fail - that's OK!)

### 5. Set Environment Variables
In Railway dashboard → Variables:
```
GEMINI_API_KEY=your_key_here
NODE_ENV=production
CHANNEL_ID=your_channel_id_here (optional)
CHANNEL_LEVEL=A1 (optional, default: A1)
```

Click "Redeploy"

### 6. Authenticate WhatsApp
1. In Railway → Your Service → "Shell" tab
2. Run: `npm run setup`
3. QR code appears ✅
4. Open WhatsApp → Settings → Linked Devices → Link Device
5. Scan QR code
6. Done! Session saved to disk

### 7. Test It
- **DM Bot**: Send message to your WhatsApp number
- **Channel**: Posts daily at 8:00 AM IST automatically
- **Health**: Visit `https://your-app.up.railway.app/health`

---

## 🔄 When Session Expires (Every Few Weeks)

```bash
# In Railway Shell tab
npm run setup
# Scan new QR code
# Done!
```

---

## 📱 User Commands

Send these to your WhatsApp number:

| Command | What It Does |
|---------|--------------|
| _(first message)_ | Set your German level (A1-C2) |
| `more` | Get extra word (max 3/day) |
| `flashcard` | AI quiz on learned words |
| `level` | Change your CEFR level |
| `help` | Show commands |

---

## 🎯 What You Get

### Automatic Daily Channel Posts
- Posts at 8:00 AM IST every day
- CEFR-level appropriate vocabulary
- Never repeats words
- Rich content with examples and tips

### Interactive DM Bot
- Personalized learning per user
- AI-powered flashcards  
- Progress tracking
- Multiple difficulty levels

### All From One Deployment
- No GitHub Actions needed
- No env var size issues
- One authentication
- Persistent sessions

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "QR code not showing" | Railway shell has visual terminal - should work! |
| "Session keeps expiring" | Sessions last weeks - re-auth when needed |
| "Bot not responding" | Check Railway logs, verify session exists |
| "Channel posts not working" | Verify CHANNEL_ID is set |

---

## 💰 Cost

- **Railway**: $5 free credit (lasts ~month)
- **Gemini AI**: Free tier (1,500 requests/day)
- **After free tier**: ~$5/month for Railway

---

## ✅ You're Done!

Your bot is now:
- ✅ Running 24/7
- ✅ Posting daily to channel
- ✅ Responding to DMs
- ✅ Session persists on disk
- ✅ No env var size issues

Questions? Check `DEPLOYMENT-FIXED.md` for more details!