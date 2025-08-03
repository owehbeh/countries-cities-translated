FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package.json package-lock.json* ./

RUN npm ci --only=production && npm cache clean --force

COPY src/ ./src/
COPY assets/ ./assets/

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "src/server.js"]