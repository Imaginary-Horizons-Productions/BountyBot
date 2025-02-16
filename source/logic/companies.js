/**
 * The baseline structure for logic files.
 */
const { Sequelize } = require("sequelize");

/** @type {Sequelize} */
let db;

/** *Sets the database pointer for the Company logic file*
 * @param {Sequelize} database
 */
function setDB(database) {
	db = database;
}

/** *Queries for a Company*
 * @param {string} guildId
 */
async function findOrCreateCompany(guildId) {
	return await db.models.Company.findOrCreate({ where: { id: guildId } });
}

module.exports = {
	setDB,
	findOrCreateCompany
}
