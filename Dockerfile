# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Install necessary packages for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create data directory for persistent storage
RUN mkdir -p /app/data

# NOTE: /app/.wwebjs_auth will be mounted from Render persistent disk

# Expose health check port
EXPOSE 3000

# Run the bot
CMD ["npm", "run", "bot"]