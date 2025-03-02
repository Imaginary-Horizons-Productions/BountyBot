const { Sequelize } = require("sequelize");
const { Hunter } = require("../models/users/Hunter");

/** @type {Sequelize} */
let db;

/** *Sets the database pointer for the Hunter logic file*
 * @param {Sequelize} database
 */
function setDB(database) {
	db = database;
}

/** *Avoids the foreign key error caused by creating a Hunter before their User exists*
 *
 * Requires that the Company housing the Hunter exists
 * @param {string} userId
 * @param {string} companyId
 * @returns {Promise<[Hunter, boolean]>}
 */
async function findOrCreateBountyHunter(userId, companyId) {
	await db.models.User.findOrCreate({ where: { id: userId } });
	return db.models.Hunter.findOrCreate({ where: { userId, companyId } });
}

/** *Queries directly for a Hunter*
 *
 * If the Hunter might not exist yet, use `findOrCreateBountyHunter` instead
 * @param {string} userId
 * @param {string} companyId
 * @returns {Promise<Hunter | null>}
 */
function findOneHunter(userId, companyId) {
	return db.models.Hunter.findOne({ where: { userId, companyId } });
}

/** *Sets a Hunter's Profile Color*
 * @param {string} userId
 * @param {string} companyId
 * @param {string} color
 */
function setHunterProfileColor(userId, companyId, color) {
	return db.models.Hunter.update({ profileColor: color }, { where: { userId, companyId } });
}

module.exports = {
	setDB,
	findOrCreateBountyHunter,
	findOneHunter,
	setHunterProfileColor
}
