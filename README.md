# Chess implementation using Twilio SMS and MMS.

### Powered by Node and served via Express. Simple chatbot interaction to get the game started, followed a game!

![](https://tools.missionmike.dev/assets/twilio-text-chess-nonumber.gif)

### Read on for details...

Uses [js-chess-engine](https://www.npmjs.com/package/js-chess-engine) under the hood for the computer player. 

To generate the board graphics, this uses [chess-image-generator](https://www.npmjs.com/package/chess-image-generator) to generate a PNG of game position layered on top of a static coordinate image via canvas.

For MMS image responses, A GET route processes a URL-encoded [FEN (Forsyth–Edwards Notation)](https://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation "Wikipedia - Forsyth–Edwards Notation") coordinate and returns PNG image content, to be bundled with Twilio's [mediaUrl in MMS](https://www.twilio.com/docs/sms/send-messages#include-media-in-your-messages). 
