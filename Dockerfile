FROM node:20-alpine

# zlib CRITICAL fix - upgrade to patched version
RUN apk update && apk upgrade --no-cache

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN rm -f .env .env.*

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
