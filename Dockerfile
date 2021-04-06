FROM node:14
WORKDIR /telegram-bot-for-teslamate
COPY package*.json ./
RUN npm ci --only=production
COPY dist/* ./
CMD [ "node", "--experimental-json-modules", "index.js" ]