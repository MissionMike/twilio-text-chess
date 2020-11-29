require("dotenv").config();

const responseData = require("./response-data.js");
const messageData = require("./message-data.js");

const jsChessEngine = require("js-chess-engine");
const bodyParser = require("body-parser");
const session = require("express-session");
const server = require("express")();
const MessagingResponse = require("twilio").twiml.MessagingResponse;

const mariadb = require("./mariadb.js");

const fs = require("fs");

server.use(bodyParser.urlencoded({ extended: true }));
server.use(session({ secret: process.env.SESSION_SECRET }));

const port = process.env.EXPRESS_PORT || 3001;

server.listen(port, () => {
	console.log(`Listening on port ${port}`);
});

/**
 * Thanks to @http://www.fen-to-image.com/manual for the quick images!
 */
server.post("/receive", (request, response) => {
	const body = request.body;
	const fromPhone = body.From.replace(/[^a-zA-Z0-9]+/g, "");
	const filename = fromPhone + ".fen";
	var boardConfigurationFromSave;

	if (typeof mariadb !== "undefined") {
		mariadb.pool
			.getConnection()
			.then((conn) => {
				conn.query(`SELECT data FROM ${mariadb.table} WHERE id = '${fromPhone}'`)
					.then((rows) => {
						if (rows[0].fen) {
							boardConfigurationFromSave = rows[0].fen;
						}
					})
					.then((res) => {
						conn.release();
					})
					.catch((err) => {
						conn.release();
					});

				conn.query(
					`INSERT IGNORE INTO ${mariadb.table} (id, city, state, country) VALUES ('${fromPhone}', '${body.FromCity}', '${body.FromState}', '${body.FromCountry}')`
				).catch((err) => {
					conn.release();
				});
			})
			.catch((err) => {
				console.log("receive sql", err);
			});
	} else {
		/**
		 * Database either doesn't exist or isn't correctly configured... fall-back to use
		 * text files
		 */
		if (fs.existsSync(`./gamedata/${filename}`)) {
			try {
				const data = fs.readFileSync(`./gamedata/${filename}`, "utf8");
				boardConfigurationFromSave = data;
			} catch (err) {
				console.error("receive file", err);
			}
		}
	}

	const step = request.session.step;
	const lastReceivedTimestamp = request.session.lastReceivedTimestamp;
	const boardConfiguration = request.session.boardConfiguration || boardConfigurationFromSave;
	const fenUrlBase = "http://www.fen-to-image.com/image/36/double/coords/";

	if (!step) {
		request.session.step = 1;
	} else {
		request.session.step += 1;
	}

	let message = messageData.intro;
	let mediaUrl = "";

	if (!boardConfiguration && step >= 1 && Date.now() - lastReceivedTimestamp > 10) {
		if (acceptableAnswer("yes", body.Body)) {
			let game = new jsChessEngine.Game();
			let fen = game.exportFEN();
			let fenForUrl = fen.split(" ")[0];

			message = messageData.start;
			mediaUrl = fenUrlBase + fenForUrl;

			request.session.boardConfiguration = fen;
			saveGame(fromPhone, fen);
		} else if (acceptableAnswer("no", body.Body)) {
			message = messageData.playLater;
		} else {
			message = messageData.sorry[Math.floor(Math.random() * messageData.sorry.length)];
		}
	} else if (boardConfiguration) {
		if (acceptableAnswer("commands", body.Body)) {
			message = messageData.commands;
		} else if (
			acceptableAnswer("restart", request.session.lastMessageReceived) &&
			acceptableAnswer("yes", body.Body)
		) {
			request.session.boardConfiguration = undefined;
			saveGame(fromPhone, null);
			message = messageData.resetComplete;
		} else if (
			acceptableAnswer("restart", request.session.lastMessageReceived) &&
			acceptableAnswer("no", body.Body)
		) {
			message = messageData.resetCancelled;
		} else if (acceptableAnswer("restart", body.Body)) {
			message = messageData.reset;
		} else if (acceptableAnswer("status", body.Body)) {
			let game = new jsChessEngine.Game(boardConfiguration);
			let fen = game.exportFEN();
			let fenForUrl = fen.split(" ")[0];

			request.session.boardConfiguration = fen;
			mediaUrl = fenUrlBase + fenForUrl;

			message = messageData.leftOff;
		} else if (acceptableAnswer("difficulty", body.Body)) {
		} else {
			let game = new jsChessEngine.Game(boardConfiguration);
			let moveData = body.Body.toLowerCase().replace(/[^a-zA-Z0-9]+/g, "");

			if (moveData.match(/[a-zA-Z][0-9][a-zA-Z][0-9]/)) {
				moveData = moveData.replace(" ", "");

				let moveFrom = moveData.substring(0, 2);
				let moveTo = moveData.substring(2, 4);

				try {
					game.move(moveFrom, moveTo);
					game.aiMove();

					let fen = game.exportFEN();
					let fenForUrl = fen.split(" ")[0];

					request.session.boardConfiguration = fen;
					mediaUrl = fenUrlBase + fenForUrl;

					message = "Your turn!";

					saveGame(fromPhone, fen);
				} catch (e) {
					message = e.message;
				}
			} else {
				message = messageData.invalidMove.replace("{MOVE}", body.Body);
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
});

/**
 * Function to help determine if a provided text value matches any acceptible
 * interpreted values
 *
 * @param {string} target the interpreted value we're trying to match
 * @param {string} providedText the text provided to interpreter
 */
function acceptableAnswer(target = "", providedText = "") {
	target = target.toLowerCase();
	providedText = providedText.toLowerCase().trim();

	if (!responseData[target]) {
		return false;
	}
	return responseData[target].includes(providedText);
}

/**
 * Helper function to write gamedata to local file
 *
 * @param {string} filename name of the file
 * @param {string} fen game data in FEN format
 */
function saveGame(fromPhone, fen) {
	if (!fromPhone || !fen) {
		return;
	}

	if (typeof mariadb !== "undefined") {
		mariadb.pool
			.getConnection()
			.then((conn) => {
				conn.query(
					`UPDATE ${mariadb.table} SET fen='${fen}', updated_date = CURRENT_TIMESTAMP WHERE id = '${fromPhone}'`
				).catch((err) => {
					conn.release();
				});
			})
			.catch((err) => {
				console.log("saveGame", err);
			});
	} else {
		/**
		 * Database either doesn't exist or isn't correctly configured... fall-back to use
		 * text files
		 */
		const filename = fromPhone + ".fen";

		if (!fs.existsSync("./gamedata")) {
			fs.mkdirSync("./gamedata");
		}

		fs.writeFileSync(`./gamedata/${filename}`, fen, "utf8");
	}
}
