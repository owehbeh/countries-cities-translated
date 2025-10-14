FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production --silent

COPY . .

EXPOSE 3000

CMD ["npx", "pm2-runtime", "ecosystem.config.js"]
