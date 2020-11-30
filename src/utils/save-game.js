const mariadb = require("../mariadb.js");

/**
 * Helper function to write gamedata to local file
 *
 * @param {string} fromPhone incoming phone number
 * @param {string} fen game data in FEN format
 */
module.exports = function (fromPhone, fen, difficulty = 2) {
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
};
