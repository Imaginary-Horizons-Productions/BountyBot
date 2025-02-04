/**
 * The baseline structure for logic files.
 */
const { Sequelize } = require("sequelize");

/** @type {Sequelize} */
let db;

/**
 * Set the database pointer for this logic file.
 * @param {Sequelize} database
 */
function setDB(database) {
	db = database;
}

module.exports = {
	setDB
}
