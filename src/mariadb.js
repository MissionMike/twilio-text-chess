const mariadb = require("mariadb");
const table = process.env.SQL_DATABASE + "." + process.env.SQL_TABLE;
const pool = mariadb.createPool({
	host: process.env.SQL_HOST,
	user: process.env.SQL_USER,
	password: process.env.SQL_PASSWORD,
	connectionLimit: 5,
});

module.exports = {
	table,
	pool,
};
