const { Sequelize } = require("sequelize");

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

/** *Get the number of participating bounty hunters in the specified Season*
 * @param {string} seasonId
 */
function getParticipantCount(seasonId) {
	return db.models.Participation.count({ where: { seasonId } });
}

/** @param {string} companyId */
function deleteCompanySeasons(companyId) {
	return db.models.Season.destroy({ where: { companyId } });
}

module.exports = {
	setDB,
	createSeason,
	findOrCreateCurrentSeason,
	findOneSeason,
	getParticipantCount,
	deleteCompanySeasons
}
