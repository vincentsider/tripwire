# Tripwire headless scan service.
# The Playwright base image ships a matching Chromium + all system libraries,
# so no `playwright install` is needed at runtime.
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

WORKDIR /app

# Install deps (including tsc for the build), compile, then drop dev deps.
COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Run as the image's non-root user.
USER pwuser
CMD ["node", "dist/server.js"]
