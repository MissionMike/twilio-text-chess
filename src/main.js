require("dotenv").config();

const port = process.env.EXPRESS_PORT || 3001;

/**
 * Express setup
 */
const server = require("express")();
const bodyParser = require("body-parser");
const session = require("express-session");
var MemoryStore = require("memorystore")(session);

server.use(bodyParser.urlencoded({ extended: true }));
server.use(
	session({
		cookie: { maxAge: 86400000 },
		store: new MemoryStore({
			checkPeriod: 86400000, // prune expired entries every 24h
		}),
		resave: false,
		secret: process.env.SESSION_SECRET,
		saveUninitialized: true,
	})
);
server.listen(port, () => {
	console.log(`Listening on port ${port}`);
});

/**
 * Twilio setup
 */
const MessagingResponse = require("twilio").twiml.MessagingResponse;

/**
 * POST requests come from Twilio; aim to parse the text and determine the
 * next steps.
 */
server.post("/receive", (request, response) => {
	const fetchGame = require("./utils/fetch-game.js"); // Helper to fetch game data from mariadb or JSON storage

	const body = request.body;
	const fromPhone = body.From.replace(/[^a-z0-9]+/g, ""); // Keep only digits
	const lastReceivedTimestamp = request.session.lastReceivedTimestamp; // This 'last received' timestamp is set a the end of this .post block
	const step = request.session.step; // Which step are we in this conversation?

	if (!step) {
		request.session.step = 1;
	} else {
		request.session.step += 1;
	}

	fetchGame(fromPhone, body)
		.then((boardConfigurationFromSave, err) => {
			if (err) {
				throw err;
			}

			const urlFenBase = process.env.URL_FENBASE || "localhost:" + port;
			const jsChessEngine = require("js-chess-engine"); // @link https://www.npmjs.com/package/js-chess-engine
			const isResponse = require("./utils/is-response.js"); // Helper to parse responses
			const saveGame = require("./utils/save-game.js"); // Helper to interface w/ mariadb or JSON storage
			const messageData = require("./data/data-messages.js"); // Data for text message responses

			var boardConfiguration = boardConfigurationFromSave.fen || null;
			var difficulty = boardConfigurationFromSave.difficulty || 2;

			let message = messageData.intro;
			let mediaUrl = "";

			if (!boardConfiguration && step >= 1 && Date.now() - lastReceivedTimestamp > 10) {
				if (isResponse("yes", body.Body)) {
					let game = new jsChessEngine.Game();
					let fen = game.exportFEN();

					message = messageData.start;
					mediaUrl = urlFenBase + encodeURIComponent(fen);

					saveGame(fromPhone, fen);
				} else if (isResponse("no", body.Body)) {
					message = messageData.playLater;
				} else {
					message =
						messageData.sorry[Math.floor(Math.random() * messageData.sorry.length)];
				}
			} else if (boardConfiguration && boardConfiguration !== null) {
				let game = new jsChessEngine.Game(boardConfiguration);

				if (isResponse("commands", body.Body)) {
					message = messageData.commands;
				} else if (
					isResponse("restart", request.session.lastMessageReceived) &&
					isResponse("yes", body.Body)
				) {
					saveGame(fromPhone, null);
					message = messageData.resetComplete;
					request.session.step = 0;
				} else if (
					isResponse("restart", request.session.lastMessageReceived) &&
					isResponse("no", body.Body)
				) {
					message = messageData.resetCancelled;
				} else if (isResponse("restart", body.Body)) {
					message = messageData.reset;
				} else if (isResponse("status", body.Body)) {
					try {
						mediaUrl = urlFenBase + encodeURIComponent(game.exportFEN());
						message = messageData.leftOff;
					} catch (err) {
						message = messageData.statusError;
					}
				} else if (isResponse("difficulty", body.Body, true)) {
					try {
						let newLevel = parseInt(body.Body.replace(/\D+/g, ""));
						if (newLevel >= 0 && newLevel <= 3) {
							saveGame(fromPhone, game.exportFEN(), newLevel);
							message = messageData.difficultyUpdated.replace(
								"{DIFFICULTY}",
								newLevel
							);
						} else {
							message = messageData.difficultyError.replace(
								"{DIFFICULTY}",
								body.Body
							);
						}
					} catch (err) {
						message = messageData.difficultyError.replace("{DIFFICULTY}", newLevel);
					}
				} else {
					let moveData = body.Body.toLowerCase().replace(/[^a-zA-Z0-9]+/g, "");

					if (moveData.match(/[a-zA-Z][0-9][a-zA-Z][0-9]/)) {
						moveData = moveData.replace(" ", "");
						let moveFrom = moveData.substring(0, 2);
						let moveTo = moveData.substring(2, 4);

						try {
							game.move(moveFrom, moveTo);
							game.aiMove(difficulty);

							let fen = game.exportFEN();
							mediaUrl = urlFenBase + encodeURIComponent(fen);
							message =
								messageData.yourTurn[
									Math.floor(Math.random() * messageData.yourTurn.length)
								];

							saveGame(fromPhone, fen, difficulty);
						} catch (err) {
							console.log(err.message);
							message = err.message;
						}
					} else {
						message = messageData.invalidMove.replace("{MOVE}", body.Body);
					}
				}

				if (game.isFinished === true) {
					if (game.checkMate === true) {
						message = message.checkMate;
					} else {
						message = message.staleMate;
					}
				}
			}

			request.session.lastReceivedTimestamp = Date.now();
			request.session.lastMessageReceived = body.Body;

			const twiml = new MessagingResponse();
			const twimlMessage = twiml.message();
			twimlMessage.body(message);

			if (mediaUrl.length > 0) {
				twimlMessage.media(mediaUrl);
			}

			response.set("Content-type", "text/xml");
			response.send(twiml.toString());
		})
		.catch((err) => {
			console.log(err);
		});
});

/**
 * GET requests to /fenpng return a PNG image of the current game board,
 * as represented by GET variable ?fen=[fen-format-data-string]
 */
server.get("/fenpng", (request, response) => {
	if (request.query.fen) {
		const Canvas = require("canvas");
		const fs = require("fs");

		/**
		 * @link https://www.npmjs.com/package/chess-image-generator
		 */
		var ChessImageGenerator = require("chess-image-generator"),
			size = 720;

		var imageGenerator = new ChessImageGenerator({
			size,
			style: "merida",
		});

		imageGenerator.loadFEN(request.query.fen);

		console.log(request.query.fen);

		response.contentType("image/png");

		imageGenerator.generateBuffer().then((boardPositionPng) => {
			fs.readFile(__dirname + "/../assets/board-coords.png", function (err, data) {
				if (err) {
					response.send(boardPositionPng); // Error encountered, send the board without the coords
					console.log(err);
				}

				var img = new Canvas.Image(); // Create a new Image
				img.src = data;

				var canvas = new Canvas.Canvas(img.width, img.height, "png"); // Expects an 852x852px image

				var ctx = canvas.getContext("2d");
				ctx.drawImage(img, 0, 0, img.width, img.height);

				var boardPosition = new Canvas.Image();
				boardPosition.src = boardPositionPng;

				ctx.drawImage(boardPosition, 66, 66, size, size);

				let boardPng = canvas.toBuffer();
				response.send(boardPng);
			});
		});
	}
});
