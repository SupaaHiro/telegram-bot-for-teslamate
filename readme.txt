How execute locally (development)
 1. Configure a VPS with teslamate with traefik
    https://www.teslaev.co.uk/how-to-setup-and-run-teslamate-for-free-on-google-cloud/

    Requirement:
     - VPS must have a static IP
     - Second level domain with DNS management included
 2. Create a telegram account, in case you don't have one yet (https://telegram.org/)
 3. Retrieve your chat ID by contacting the IDBot (@myidbot)
 4. Create a new bot by contacting the BotFather (@BotFather)
     Detailed guide here -> https://www.telegram-group.com/en/blog/create-bot-telegram/
 5. Configure telegram.json
 6. Configure mqtt-client.json
 7. Install dev dependencies
    npm install dev
 8. Rebuild the project with CTRL-SHIFT-B 
 9. Execute it with npm run start

Advanced configurations
  - MQTT over TSL
    If the MQTT broker is not local, be sure to use TSL and setup user/password authentication !
    If you have teslamate with traefik check the docker-compose.yml example under config/teslamate
