# 🇩🇪 WhatsApp German Learning Bot

An intelligent WhatsApp bot that teaches German vocabulary through daily words and interactive features. Built with TypeScript, powered by Google Gemini AI, and designed for CEFR-level learning (A1-C2).

## 🚀 Features

### 📅 Daily Word Channel
- **Automated daily posts** to your WhatsApp channel via GitHub Actions
- **CEFR-level appropriate** vocabulary (A1 through C2)
- **Smart memory system** - never repeats words, builds on previous lessons
- **Rich content**: pronunciation, examples, memory tips, and cultural context

### 💬 Interactive DM Bot
- **Personalized onboarding** - users select their CEFR level
- **Extra words on demand** - "more" command (max 3/day per user)
- **AI-powered flashcards** - spaced repetition quizzes on learned words
- **Level management** - users can change their learning level anytime
- **Progress tracking** - SQLite database stores user history and performance

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions (Free)                    │
│              Daily Channel Posts at 8:00 AM IST            │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   WhatsApp Channel                         │
│              📚 Daily German Word Posts                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Render.com (DM Bot)                       │
│              🤖 Interactive User Features                   │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **WhatsApp**: whatsapp-web.js with Puppeteer
- **AI**: Google Gemini 1.5 Flash (free tier)
- **Database**: SQLite with better-sqlite3
- **Deployment**: 
  - GitHub Actions (channel automation)
  - Render.com (DM bot hosting)
- **Docker**: Alpine-based container for production

## 📋 Prerequisites

Before you begin, you'll need:

1. **Dedicated WhatsApp number** (don't use your personal number)
2. **Google Gemini API key** (free at [aistudio.google.com](https://aistudio.google.com))
3. **GitHub account** for automation
4. **Render.com account** for bot hosting (free tier available)
5. **Node.js 20+** for local development

## 📚 Documentation

- **[Production Deployment Guide](docs/PRODUCTION-DEPLOYMENT.md)** - Complete step-by-step deployment instructions
- **[Session Persistence Guide](docs/SESSION-PERSISTENCE.md)** - How WhatsApp authentication works and session management strategies

## 🚀 Quick Start

### 1. Repository Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd whatsapp-german

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 2. Environment Configuration

Edit `.env` with your credentials:

```env
# Get from https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# Your WhatsApp channel ID (see setup guide below)
CHANNEL_ID=your_channel_id_here

# Default level for channel posts (A1-C2)
CHANNEL_LEVEL=A1
```

### 3. WhatsApp Channel Setup

1. **Create a Channel**: Open WhatsApp → Channels → "+" → "Create channel"
2. **Name it**: e.g., "🇩🇪 German Daily Words"
3. **Get Channel ID**: 
   - Tap channel name → "Invite via link"
   - Copy the ID from `https://whatsapp.com/channel/XXXXXXXXXX`
   - Use `XXXXXXXXXX` as your `CHANNEL_ID`

### 4. Authentication Setup

```bash
# Generate WhatsApp session (scan QR code)
npm run setup
```

**Important**: Save the base64 string output - you'll need it for deployment!

### 5. GitHub Actions Setup

Add these secrets in your GitHub repository (Settings → Secrets → Actions):

- `GEMINI_API_KEY` - Your Gemini API key
- `CHANNEL_ID` - Your WhatsApp channel ID  
- `CHANNEL_LEVEL` - Default level (A1-C2)
- `WWEBJS_AUTH` - Base64 string from setup step
- `GH_PAT` - GitHub Personal Access Token (repo permissions)

### 6. Render Deployment

1. **Connect Repository**: Link your GitHub repo to Render
2. **Configure Service**: 
   - Type: Web Service
   - Environment: Docker
   - Region: Choose closest to your users
3. **Set Environment Variables**:
   - `NODE_ENV=production`
   - `GEMINI_API_KEY` (your API key)
   - `WWEBJS_AUTH` (base64 string from setup)

## 📱 User Commands

Once deployed, users can DM your WhatsApp number:

| Command | Description |
|---------|-------------|
| _(first message)_ | Triggers welcome + level selection |
| `more` | Get extra word at your level (max 3/day) |
| `flashcard` | AI quiz on your learned words |
| `level` | Change your CEFR level (A1-C2) |
| `help` | Show all available commands |

## 🔧 Development

### Local Testing

```bash
# Test channel posting
npm run start

# Run DM bot locally
npm run bot

# Development mode (auto-reload)
npm run dev
```

### Maintenance Commands

```bash
# Re-authenticate when session expires
npm run reauth

# Check bot health
RENDER_URL=your-app.onrender.com npm run check

# Backup session locally
node scripts/backup-session.js
```

### Database

The bot uses SQLite with these tables:

- `users` - User profiles and learning progress
- `word_history` - Words learned by each user
- `daily_requests` - Rate limiting for "more" command
- `flashcard_attempts` - Quiz performance tracking

### Adding New Features

Key files to modify:

- `src/bot.ts` - DM bot logic and commands
- `src/vocabulary.ts` - Word generation and CEFR topics
- `src/index.ts` - Channel posting logic
- `src/db.ts` - Database operations

## 🌍 CEFR Levels & Topics

The bot supports all Common European Framework levels:

- **A1** (20 topics): Greetings, Numbers, Colors, Family, Food, etc.
- **A2** (18 topics): Daily Routines, Past Tense, Travel, etc.
- **B1** (14 topics): Opinions, Subjunctive, Media, etc.
- **B2** (11 topics): Formal Writing, Economy, Idioms, etc.  
- **C1** (11 topics): Academic Language, Literature, etc.
- **C2** (7 topics): Archaic Language, Rhetoric, etc.

Topics cycle automatically, ensuring diverse vocabulary exposure.

## 🔒 Security & Privacy

- **Dedicated Number**: Always use a separate WhatsApp number
- **Environment Secrets**: Never commit `.env` or authentication files
- **Session Management**: WhatsApp sessions are encrypted and base64-encoded
- **Rate Limiting**: Built-in limits prevent spam and abuse
- **Local Database**: User data stored locally, not shared with third parties

## 🔄 Session Management & Re-Authentication

**Important**: WhatsApp Web sessions expire every 1-2 months. When this happens:

```bash
# 1. Run re-authentication locally (scan QR code)
npm run reauth

# 2. Update the new WWEBJS_AUTH token in:
#    - GitHub Secrets (for Actions)
#    - Render Environment Variables (for DM bot)

# 3. Restart/redeploy services
```

**Why local?** QR codes can only be scanned on a screen you can see. Production servers can't display QR codes, so re-authentication must happen on your local machine.

**How to minimize re-auth frequency:**
- ✅ Use Render with persistent disk (sessions last 1-2 months)
- ✅ Keep bot actively used (extends session life)
- ✅ Consider VPS deployment for longer sessions (3-6 months)

See [docs/SESSION-PERSISTENCE.md](docs/SESSION-PERSISTENCE.md) for detailed strategies.

---

## 🆘 Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| "GEMINI_API_KEY not set" | Add API key to environment variables |
| "CHANNEL_ID not set" | Add channel ID to GitHub secrets/Render env |
| QR code not appearing | Run `npm run setup` locally |
| "Auth failure" | Delete `.wwebjs_auth/`, re-run setup |
| Bot not responding | Check Render logs, verify WWEBJS_AUTH |
| GitHub Action failing | Check secrets, verify GH_PAT permissions |

### Logs & Debugging

```bash
# Check local logs
npm run bot

# Render logs
# Visit your service dashboard → Logs tab

# GitHub Actions logs  
# Visit your repository → Actions → latest workflow run
```

## 📊 Monitoring

### GitHub Actions
- Daily runs at 8:00 AM IST
- Manual trigger available via "Run workflow"
- Automatic progress tracking in `data/progress.json`

### Render Health Check
- Endpoint: `https://your-app.onrender.com/health`
- Monitors: uptime, service status, timestamp
- Auto-restart on failure

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality  
4. Ensure TypeScript compilation passes
5. Submit a pull request

## 📄 License

ISC License - see `package.json` for details.

## 🙋‍♂️ Support

- **Issues**: Use GitHub Issues for bug reports
- **Features**: Submit feature requests via GitHub Discussions
- **Documentation**: Check `DEPLOYMENT.md` for detailed deployment guide

---

**Built with ❤️ for German language learners worldwide**