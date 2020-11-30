require("dotenv").config();

const urlFenBase = process.env.URL_FENBASE;

const responseData = require("./response-data.js");
const messageData = require("./message-data.js");

const jsChessEngine = require("js-chess-engine");
const Canvas = require("canvas");

const bodyParser = require("body-parser");
const session = require("express-session");
var MemoryStore = require("memorystore")(session);
const server = require("express")();
const MessagingResponse = require("twilio").twiml.MessagingResponse;

const mariadb = require("./mariadb.js");
const fs = require("fs");

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

const port = process.env.EXPRESS_PORT || 3001;

server.listen(port, () => {
	console.log(`Listening on port ${port}`);
});

server.post("/receive", (request, response) => {
	const body = request.body;
	const fromPhone = body.From.replace(/[^a-zA-Z0-9]+/g, "");
	const lastReceivedTimestamp = request.session.lastReceivedTimestamp;
	const step = request.session.step;

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

			var boardConfiguration = boardConfigurationFromSave.fen || null;
			var difficulty = boardConfigurationFromSave.difficulty || 2;

			let message = messageData.intro;
			let mediaUrl = "";

			if (
				!boardConfiguration &&
				step >= 1 &&
				Date.now() - lastReceivedTimestamp > 10
			) {
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
					resetGame(fromPhone);
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

server.get("/fenpng", (request, response) => {
	if (request.query.fen) {
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

/**
 * Function to help determine if a provided text value matches any acceptible
 * interpreted values
 *
 * @param {string} target the interpreted value we're trying to match
 * @param {string} providedText the text provided to interpreter
 */
function isResponse(target = "", providedText = "") {
	target = target.toLowerCase();
	providedTextClean = providedText
		.toLowerCase()
		.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
		.trim();

	if (!responseData[target]) {
		return false;
	}
	return responseData[target].includes(providedTextClean);
}

/**
 * Helper function to write gamedata to local file
 *
 * @param {string} fromPhone incoming phone number
 * @param {string} fen game data in FEN format
 */
function saveGame(fromPhone, fen, difficulty = 2) {
	if (!fromPhone) {
		return;
	}

	if (typeof mariadb !== "undefined") {
		mariadb.pool
			.getConnection()
			.then((conn) => {
				if (fen === null) {
					conn.query(
						`UPDATE ${mariadb.table} SET fen=NULL, difficulty=${difficulty}, updated_date = CURRENT_TIMESTAMP WHERE id = '${fromPhone}'`
					).catch((err) => {
						conn.release();
					});
				} else {
					conn.query(
						`UPDATE ${mariadb.table} SET fen='${fen}', difficulty=${difficulty}, updated_date = CURRENT_TIMESTAMP WHERE id = '${fromPhone}'`
					).catch((err) => {
						conn.release();
					});
				}
			})
			.catch((err) => {
				console.log("saveGame", err);
			});
	} else {
		/**
		 * Database either doesn't exist or isn't correctly configured... fall-back to use
		 * text files
		 */
		const filename = fromPhone + ".json";

		if (!fs.existsSync("./gamedata")) {
			fs.mkdirSync("./gamedata");
		}

		let fenData = {
			fen,
			difficulty,
		};

		fs.writeFileSync(`./gamedata/${filename}`, JSON.stringify(fenData), "utf8");
	}
}

/**
 * Wrapper function to reset a game
 *
 * @param {string} fromPhone phone number for associated game
 */
function resetGame(fromPhone) {
	saveGame(fromPhone, null);
}

/**
 * Fetch saved game data
 *
 * @param {string} fromPhone id for data
 * @param {object} body from Twilio
 */
function fetchGame(fromPhone, body) {
	return new Promise((resolve, reject) => {
		if (typeof mariadb !== "undefined") {
			mariadb.pool
				.getConnection()
				.then((conn) => {
					conn.query(
						`SELECT fen, difficulty FROM ${mariadb.table} WHERE id = '${fromPhone}'`
					)
						.then((rows) => {
							if (rows[0]) {
								resolve(rows[0]);
							}
						})
						.then((res) => {
							conn.release();
						})
						.catch((err) => {
							reject(err);
							conn.release();
						});

					conn.query(
						`INSERT IGNORE INTO ${mariadb.table} (id, city, state, country, difficulty) VALUES ('${fromPhone}', '${body.FromCity}', '${body.FromState}', '${body.FromCountry}', 2)`
					).catch((err) => {
						conn.release();
					});
				})
				.catch((err) => {
					console.log("receive sql", err);
				});
		} else {
			/**
			 * Database either doesn't exist or isn't correctly configured... fall-back to store
			 * game data in .json files
			 */
			const filename = fromPhone + ".json";
			let fenData = {
				fen: "",
				difficulty: 2,
			};

			if (fs.existsSync(`./gamedata/${filename}`)) {
				try {
					fenData = fs.readFileSync(`./gamedata/${filename}`, "utf8");
					fenData = JSON.parse(fenData);
					resolve(fenData);
				} catch (err) {
					reject(err);
					console.error("receive file", err);
				}
			} else {
				resolve(fenData);
			}
		}
	});
}
