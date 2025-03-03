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

/** *Sets the deletedAt of the selected Company (Companies are paranoid)*
 * @param {string} companyId
 */
function deleteCompany(companyId) {
	return db.models.Company.destroy({ where: { id: companyId } });
}

module.exports = {
	setDB,
	findOrCreateCompany,
	findCompanyByPK,
	deleteCompany
}
