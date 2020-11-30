# Chess implementation using Twilio SMS and MMS.

### Powered by Node and served via Express. Simple chatbot interaction to get the game started, followed a game!

![](https://missionmike.dev/assets/twilio-text-chess.gif)

### Read on for details...

Uses [js-chess-engine](https://www.npmjs.com/package/js-chess-engine) under the hood for the computer player. 

To generate the board graphics, this uses [chess-image-generator](https://www.npmjs.com/package/chess-image-generator) to generate a PNG of game position layered on top of a static coordinate image via canvas.

For MMS image responses, A GET route processes a URL-encoded [FEN (Forsyth–Edwards Notation)](https://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation "Wikipedia - Forsyth–Edwards Notation") coordinate and returns PNG image content, to be bundled with Twilio's [mediaUrl in MMS](https://www.twilio.com/docs/sms/send-messages#include-media-in-your-messages). 

Example PNG image: [https://sms.missionmike.dev/fenpng/?fen=**3qk2r%2Fpbp1bp1p%2F2np1npP%2F1p2p1N1%2F1P2PP2%2F8%2F2PP2PR%2FrNBQKB2%20w%20Qk%20-%200%2013**](https://sms.missionmike.dev/fenpng/?fen=3qk2r%2Fpbp1bp1p%2F2np1npP%2F1p2p1N1%2F1P2PP2%2F8%2F2PP2PR%2FrNBQKB2%20w%20Qk%20-%200%2013) --Try replacing the **bold** string with your own URL-encoded FEN string.
