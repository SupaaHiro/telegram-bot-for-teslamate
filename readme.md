# Before you start
 - Configure a VPS with teslamate with traefik
    https://www.teslaev.co.uk/how-to-setup-and-run-teslamate-for-free-on-google-cloud/

    Requirements:
     - VPS must have a static IP
     - Second level domain with DNS management included

    Pay attention when you configure Google VPS, only the f1-micro is free!
    Even with the free tier, I got few extra charges. So I bought a cheap VPS at contabo https://contabo.com/en/vps/

 - Create a telegram account, in case you don't have one yet (https://telegram.org/)
 - Retrieve your chat ID by contacting the IDBot (@myidbot)
 - Create a new bot by contacting the BotFather (@BotFather)
    Detailed guide here -> https://www.telegram-group.com/en/blog/create-bot-telegram/
 - Modify config/telegram-bot-for-teslamate/telegram.json
 - Modify config/telegram-bot-for-teslamate/mqtt-client.json

# Easy Install with docker-compose
   - Follow this guide (https://docs.teslamate.org/docs/guides/traefik/)
   - Modify config/.env and config/mosquitto.passwd
   - Upload config/ into your VPS (e.g. /home/<user>/teslamate)
   - Execute docker-compose up -d

# Use a pre-built docker image
   docker pull supaahiro/telegram-bot-for-teslamate:latest
   docker cp config/telegram-bot-for-teslamate/. mycontainer:/config/
   docker run -d supaahiro/telegram-bot-for-teslamate

# Build from source code
```
   npm install -g typescript@4.2.3
   git clone git@github.com:SupaaHiro/telegram-bot-for-teslamate.git
   git fetch --tags
   git checkout tags/latest -b latest
   npm install
   cd node_modules/.bin/ && tsc && cd ../..
   mkdir dist/config
```
Choice one of the following:

### Build a docker image
```
   docker build -t supaahiro/telegram-bot-for-teslamate .
   docker cp config/telegram-bot-for-teslamate/. mycontainer:/config/
   docker run -d supaahiro/telegram-bot-for-teslamate
```
### Execute locally
```
 npm run start
```

# Advanced configurations & troubleshooting
  - MQTT over TSL
    If the MQTT broker is not local, be sure to use TSL and setup user/password authentication !
    If you have teslamate with traefik check the docker-compose.yml example under config/teslamate
  
  - Docker issues    
    If the docker crashes try run without detaching the terminal
     docker run supaahiro/telegram-bot-for-teslamate

    You can also attach terminal with this command
     docker attach --sig-proxy=false e98ff710caf7
    NB. --sig-proxy=false to prevent signals being passed to container, otherwise hitting Ctrl-c will kill your container !
   
    To detach from an attached container, successively hit CTRL-P then CTRL-q or alternatively CTRL+C
