# 🚀 Quick Start Guide

Get your WhatsApp German learning bot up and running in 15 minutes!

## ✅ What You'll Get

- ✨ **Daily automated German words** posted to WhatsApp channel
- 💬 **Interactive DM bot** for personalized learning
- 🎯 **CEFR-level vocabulary** (A1 through C2)
- 🤖 **AI-powered flashcards** for spaced repetition

## 📦 Prerequisites Checklist

- [ ] Dedicated WhatsApp number (not your personal one!)
- [ ] Node.js 20+ installed
- [ ] GitHub account
- [ ] Google Gemini API key ([get free here](https://aistudio.google.com/app/apikey))
- [ ] Render.com account (free tier works)

## 🏃‍♂️ 5-Minute Setup

### 1. Clone & Install
```bash
git clone <your-repo>
cd whatsapp-german
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Create WhatsApp Channel
1. Open WhatsApp → **Channels** → **Create channel**
2. Name it: "🇩🇪 German Daily Words"
3. Get channel ID from invite link
4. Add to `.env` as `CHANNEL_ID`

### 4. Authenticate WhatsApp
```bash
npm run setup
```
- Scan QR code with your dedicated WhatsApp number
- Save the base64 token that appears

### 5. Deploy to Render
1. Connect GitHub repo to Render
2. Create new **Web Service**
3. Set these environment variables:
   - `NODE_ENV=production`
   - `GEMINI_API_KEY` (from Google AI Studio)
   - `WWEBJS_AUTH` (from setup step)

### 6. Setup GitHub Actions
Add these secrets in GitHub → Settings → Secrets → Actions:
- `GEMINI_API_KEY`
- `CHANNEL_ID`
- `CHANNEL_LEVEL` (e.g., "A1")
- `WWEBJS_AUTH`
- `GH_PAT` (Personal Access Token with repo permissions)

## 🎉 You're Done!

- **Daily words**: Auto-post at 8:00 AM IST via GitHub Actions
- **DM bot**: Running 24/7 on Render
- **Health check**: `https://your-app.onrender.com/health`

## 🔧 Common Commands

```bash
# Test locally
npm run bot               # Run DM bot
npm run start            # Test channel posting

# When session expires
npm run reauth           # Generate new WWEBJS_AUTH token

# Health monitoring
npm run check            # Check bot health
```

## 📱 User Experience

Users can DM your WhatsApp number and:
- Get personalized level selection (A1-C2)
- Request extra words with "more" (max 3/day)
- Practice with AI flashcards using "flashcard"
- Change levels anytime with "level"

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Bot not responding | Check Render logs, verify `WWEBJS_AUTH` |
| Session expired | Run `npm run reauth` locally |
| GitHub Action fails | Verify all 5 secrets are set |
| Health check fails | Check Render service is running |

## 📚 Next Steps

- Read [`README.md`](./README.md) for detailed documentation
- Check [`SETUP-GUIDE.md`](./SETUP-GUIDE.md) for deployment details
- Monitor health with `npm run check`

## 🔄 Session Management

**Sessions expire every 2-4 weeks.** When that happens:

1. Run `npm run reauth` on your local machine
2. Update `WWEBJS_AUTH` in:
   - GitHub Secrets
   - Render Environment Variables
3. Redeploy Render service

**Pro tip**: The persistent disk on Render helps sessions last longer!

---

**Need help?** Check the full [README.md](./README.md) or open an issue on GitHub.