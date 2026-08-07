# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Install Chromium and required dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    udev \
    ttf-dejavu \
    && rm -rf /var/cache/apk/*

# Configure Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    CHROME_BIN=/usr/bin/chromium-browser

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create directories for persistent storage
RUN mkdir -p /app/data /app/.wwebjs_auth

# Expose health check port
EXPOSE 3000

# Run the bot
CMD ["npm", "run", "bot"]
