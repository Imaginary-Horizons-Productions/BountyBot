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

/** @param {string} companyId */
function deleteCompanySeasons(companyId) {
	return db.models.Season.destroy({ where: { companyId } });
}

module.exports = {
	setDB,
	createSeason,
	findOrCreateCurrentSeason,
	findOneSeason,
	changeSeasonXP,
	deleteCompanySeasons
}
