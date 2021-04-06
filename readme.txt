Requisites
 - Configure a VPS with teslamate with traefik
    https://www.teslaev.co.uk/how-to-setup-and-run-teslamate-for-free-on-google-cloud/

    Requirements:
     - VPS must have a static IP
     - Second level domain with DNS management included
 - Create a telegram account, in case you don't have one yet (https://telegram.org/)
 - Retrieve your chat ID by contacting the IDBot (@myidbot)
 - Create a new bot by contacting the BotFather (@BotFather)
    Detailed guide here -> https://www.telegram-group.com/en/blog/create-bot-telegram/
 - Configure telegram.json
 - Configure mqtt-client.json

Build and execute locally (development, windows/visual studio code)
 - Install dev dependencies
    npm install dev
 - Install TypeScript
    npm install -g typescript@4.2.3
    tsc --version
 - Rebuild the project with CTRL-SHIFT-B 
 - Copy configuration
   cp -r config dist/
 - Manually launch the bot
    npm run start

Build and execute locally (debian 9, console)
 - Install dependencies
    npm install
 - Install TypeScript
    npm install -g typescript@4.2.3
    tsc --version
 - Rebuild the project
    cd node_modules/.bin/ && tsc && cd ../..
 - Copy configuration
    cp -r config dist/
 - Manually launch the bot
    npm run start

Build a docker image (debian 9, console)
   - Build the docker image
    docker build -t user/telegram-bot-for-teslamate .
   - Check images list
    docker images
   - Run the docker
    docker run -d user/telegram-bot-for-teslamate
   - Check process
    docker ps
   
   If the docker crashes try run without detaching the terminal
     docker run user/telegram-bot-for-teslamate

   You can also attach terminal with this command
    docker attach --sig-proxy=false e98ff710caf7
   NB. --sig-proxy=false to prevent signals being passed to container, otherwise hitting Ctrl-c will kill your container !
   
   To detach from an attached container, successively hit CTRL-P then CTRL-q or alternatively CTRL+C

Advanced configurations
  - MQTT over TSL
    If the MQTT broker is not local, be sure to use TSL and setup user/password authentication !
    If you have teslamate with traefik check the docker-compose.yml example under config/teslamate
