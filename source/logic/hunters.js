const { Sequelize, Op } = require("sequelize");
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

/** *Find all Hunters in the specified Company*
 * @param {string} companyId
 */
function findCompanyHunters(companyId) {
	return db.models.Hunter.findAll({ where: { companyId } });
}

/** *Find the ids of all rank qualified Hunters in the specified Company that are at or above the specified Rank*
 * @param {string} companyId
 * @param {number} rankIndex
 */
async function findHunterIdsAtOrAboveRank(companyId, rankIndex) {
	const hunters = await db.models.Hunter.findAll({ where: { companyId, rank: { [Op.gte]: rankIndex } } });
	const season = await db.models.Season.findOne({ where: { companyId, isCurrentSeason: true } });
	if (!season) {
		return hunters.map(hunter => hunter.userId);
	}
	const participations = await db.models.Participation.findAll({ where: { seasonId: season.id, userId: { [Op.in]: hunters.map(hunter => hunter.userId) } } });
	const qualifiedHunterIds = [];
	for (const participation of participations) {
		if (!participation.isRankDisqualified) {
			qualifiedHunterIds.push(participation.userId);
		}
	}
	return qualifiedHunterIds;
}

/** *Sets a Hunter's Profile Color*
 * @param {string} userId
 * @param {string} companyId
 * @param {string} color
 */
function setHunterProfileColor(userId, companyId, color) {
	return db.models.Hunter.update({ profileColor: color }, { where: { userId, companyId } });
}

/** *Resets the ranks on all Hunters in the specified Company*
 * @param {string} companyId
 */
function resetCompanyRanks(companyId) {
	return db.models.Hunter.update({ rank: null, nextRankXP: null }, { where: { companyId } });
}

/** *Destroys all of the specified Company's Hunters*
 * @param {string} companyId
 */
function deleteCompanyHunters(companyId) {
	return db.models.Hunter.destroy({ where: { companyId } });
}

module.exports = {
	setDB,
	findOrCreateBountyHunter,
	findOneHunter,
	findCompanyHunters,
	findHunterIdsAtOrAboveRank,
	setHunterProfileColor,
	resetCompanyRanks,
	deleteCompanyHunters
}
