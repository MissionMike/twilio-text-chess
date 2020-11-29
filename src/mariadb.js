/**
 * Database table should have the following structure:
 * 
    CREATE TABLE gamedata (
        id varchar(15) NOT NULL,
        city varchar(85),
        state varchar(2),
        country varchar(2),
        fen varchar(90),
        created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        primary key (id)
    );
 * 
 * Set the appropriate environment variables in .env:
 * 
 * SQL_PASSWORD=
 * SQL_USER=
 * SQL_DATABASE=
 * SQL_TABLE=
 * SQL_HOST=
 */
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
