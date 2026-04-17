FROM node:20-slim

# Install Playwright dependencies
RUN apt-get update && apt-get install -y \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
    fonts-noto-color-emoji fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json tsconfig.json ./
RUN npm install

# Install Playwright browser
RUN npx playwright install chromium

# Copy source and configs
COPY src/ ./src/
COPY tpa-configs/ ./tpa-configs/

# Build TypeScript
RUN npm run build

# Health check
HEALTHCHECK --interval=60s --timeout=10s --retries=3 \
  CMD node -e "console.log('ok')" || exit 1

CMD ["npm", "start"]
