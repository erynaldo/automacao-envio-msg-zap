FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /backend

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "backend/server.js"]