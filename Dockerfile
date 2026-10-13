FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# Cloud Run inyecta la variable PORT (por defecto 8080)
CMD ["node", "server.js"]
