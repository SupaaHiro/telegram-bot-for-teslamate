FROM node:14
WORKDIR /telegram-bot-for-teslamate
COPY package*.json ./
RUN npm ci --only=production
COPY dist/. ./
COPY LICENSE ./
COPY readme.md ./
COPY config/telegram-bot-for-teslamate/. ./config
RUN mkdir /logs
CMD [ "node", "index.js" ]