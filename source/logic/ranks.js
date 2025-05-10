const { Sequelize, Op } = require("sequelize");

/** @type {Sequelize} */
let db;

/** *Set the database pointer for the Rank logic file*
 * @param {Sequelize} database
 */
function setDB(database) {
	db = database;
}

const DEFAULT_VARIANCE_THRESHOLDS = [2.5, 1, 0, -3];
const DEFAULT_RANKMOJI = ["🏆", "🥇", "🥈", "🥉"];

/** *Creates Ranks for a Company with the default emoji and variance thresholds*
 * @param {string} companyId
 * @param {string[]} roleIds
 */
function createDefaultRanks(companyId, roleIds) {
	return db.models.Rank.bulkCreate(roleIds.map((roleId, index) => ({
		companyId,
		varianceThreshold: DEFAULT_VARIANCE_THRESHOLDS[index],
		roleId,
		rankmoji: DEFAULT_RANKMOJI[index]
	})));
}

/**
 * @param {{ companyId: string, varianceThreshold: number, roleId?: string, rankmoji?: string }} rawRank
 */
function createCustomRank(rawRank) {
	return db.models.Rank.create(rawRank);
}

/**
 * @param {string} companyId
 * @param {number} varianceThreshold
 */
function findOneRank(companyId, varianceThreshold) {
	return db.models.Rank.findOne({ where: { companyId, varianceThreshold } });
}

/** *Finds all of a company's ranks and returns them in descending order*
 * @param {string} companyId
 */
function findAllRanks(companyId) {
	return db.models.Rank.findAll({ where: { companyId }, order: [["varianceThreshold", "DESC"]] });
}

/** *Deletes the specified Ranks*
 * @param {string} companyId
 * @param {number[]} varianceThresholds
 */
function deleteRanks(companyId, varianceThresholds) {
	return db.models.Rank.destroy({ where: { companyId, varianceThreshold: { [Op.in]: varianceThresholds } } });
}

/** *Deletes all of a Company's Ranks*
 * @param {string} companyId
 */
function deleteCompanyRanks(companyId) {
	return db.models.Rank.destroy({ where: { companyId } });
}

module.exports = {
	setDB,
	createDefaultRanks,
	createCustomRank,
	findOneRank,
	findAllRanks,
	deleteRanks,
	deleteCompanyRanks
}
