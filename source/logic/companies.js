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
function findOrCreateCompany(guildId) {
	return db.models.Company.findOrCreate({ where: { id: guildId } });
}

/** *Queries for a Company by primary key*
 * @param {string} guildId
 */
function findCompanyByPK(guildId) {
	return db.models.Company.findByPk(guildId);
}

module.exports = {
	setDB,
	findOrCreateCompany,
	findCompanyByPK
}
