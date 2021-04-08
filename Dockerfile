FROM node:14
WORKDIR /telegram-bot-for-teslamate
COPY package*.json ./
RUN npm ci --only=production
COPY dist/. ./
COPY LICENSE ./
COPY readme.md ./
RUN mkdir /config
CMD [ "node", "index.js" ]