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
 * @param {string} companyId
 */
function findOrCreateCompany(companyId) {
	return db.models.Company.findOrCreate({ where: { id: companyId } });
}

/** *Queries for a Company by primary key*
 * @param {string} companyId
 */
function findCompanyByPK(companyId) {
	return db.models.Company.findByPk(companyId);
}

/** *Reset the specified Company's settings to the defaults*
 * @param {string} id
 */
function resetCompanySettings(id) {
	db.models.Company.update(
		{
			announcementPrefix: "@here",
			maxSimBounties: 5,
			backupTimer: 3600000,
			festivalMultiplier: 1,
			xpCoefficient: 3,
			toastThumbnailURL: null,
			openBountyThumbnailURL: null,
			completedBountyThumbnailURL: null,
			scoreboardThumbnailURL: null,
			goalCompletionThumbnailURL: null
		},
		{ where: { id } }
	);
}

/** *Deletes the specified Company*
 * @param {string} companyId
 */
function deleteCompany(companyId) {
	return db.models.Company.destroy({ where: { id: companyId } });
}

module.exports = {
	setDB,
	findOrCreateCompany,
	findCompanyByPK,
	resetCompanySettings,
	deleteCompany
}
