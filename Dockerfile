FROM node:18-alpine

WORKDIR /app

# Dependencies pehle copy karo (cache optimization)
COPY package*.json ./
RUN npm install --production

# Source code copy karo
COPY . .

# .env file ko ignore karo (secrets ECS se aayenge)
RUN rm -f .env

EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "index.js"]