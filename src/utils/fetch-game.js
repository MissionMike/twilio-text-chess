const mariadb = require("../mariadb.js");

/**
 * Fetch saved game data
 *
 * @param {string} fromPhone id for data
 * @param {object} body from Twilio
 */
module.exports = function (fromPhone, body) {
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
};
