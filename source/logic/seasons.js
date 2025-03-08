const { Sequelize, Op } = require("sequelize");

/** @type {Sequelize} */
let db;

/** *Sets the database pointer for the Season logic file*
 * @param {Sequelize} database
 */
function setDB(database) {
	db = database;
}

/** @param {string} companyId */
function createSeason(companyId) {
	return database.models.Season.create({ companyId })
}

/** @param {string} companyId */
function findOrCreateCurrentSeason(companyId) {
	return db.models.Season.findOrCreate({ where: { companyId, isCurrentSeason: true } });
}

/**
 * @param {string} companyId
 * @param {"current" | "previous"} type
 */
function findOneSeason(companyId, type) {
	switch (type) {
		case "current":
			return db.models.Season.findOne({ where: { companyId, isCurrentSeason: true } });
		case "previous":
			return db.models.Season.findOne({ where: { companyId, isPreviousSeason: true } });
	}
}

/** *Change the specified Hunter's Seasonal XP*
 * @param {string} userId
 * @param {string} companyId
 * @param {string} seasonId
 * @param {number} xp negative numbers allowed
 */
function changeSeasonXP(userId, companyId, seasonId, xp) {
	db.models.Participation.findOrCreate({ where: { userId, companyId, seasonId }, defaults: { xp } }).then(([participation, participationCreated]) => {
		if (!participationCreated) {
			participation.increment({ xp });
		}
	});
}

/** *Get the number of participating bounty hunters in the specified Season*
 * @param {string} seasonId
 */
function getParticipantCount(seasonId) {
	return db.models.Participation.count({ where: { seasonId } });
}

/** *Get all of a Season's Participations*
 * @param {string} seasonId
 */
function findSeasonParticipations(seasonId) {
	return db.models.Participation.findAll({ where: { seasonId }, order: [["xp", "DESC"]] });
}

/** *Get Participations of the specified Users in the specified Season*
 * @param {string} seasonId
 * @param {string[]} userIds
 */
function bulkFindParticipations(seasonId, userIds) {
	return db.models.Participation.findAll({ where: { seasonId, userId: { [Op.in]: userIds } } });
}

/** *Get all the Participations of a specified Hunter*
 * @param {string} userId
 * @param {string} companyId
 */
function findHunterParticipations(userId, companyId) {
	return db.models.Participation.findAll({ where: { userId, companyId }, order: [["createdAt", "DESC"]] });
}

/**
 * @param {string} companyId
 * @param {string} stat
 */
async function incrementSeasonStat(guildId, stat) {
	const [season] = await findOrCreateCurrentSeason(guildId);
	return season.increment(stat);
}

/** @param {string} companyId */
function deleteCompanySeasons(companyId) {
	return db.models.Season.destroy({ where: { companyId } });
}

/** *Delete all Participations associated with the specified Season*
 * @param {string} seasonId
 */
function deleteSeasonParticipations(seasonId) {
	return db.models.Participation.destroy({ where: { seasonId } });
}

/** *Deletes all Participations of the specified Company*
* @param {string} companyId
*/
function deleteCompanyParticipations(companyId) {
	return db.models.Participation.destroy({ where: { companyId } });
}

module.exports = {
	setDB,
	createSeason,
	findOrCreateCurrentSeason,
	findOneSeason,
	changeSeasonXP,
	getParticipantCount,
	findSeasonParticipations,
	bulkFindParticipations,
	findHunterParticipations,
	incrementSeasonStat,
	deleteCompanySeasons,
	deleteSeasonParticipations,
	deleteCompanyParticipations
}
