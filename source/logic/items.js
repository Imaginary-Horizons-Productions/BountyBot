const { Sequelize, Op } = require("sequelize");

/** @type {Sequelize} */
let db;

/** *Set the database pointer for the Item logic file*
 * @param {Sequelize} database
 */
function setDB(database) {
	db = database;
}

/** @param {string} userId */
function getInventory(userId) {
	return db.models.Item.findAll({ where: { userId, count: { [Op.gt]: 0 } } });
}

/** *Finds the count and other data associated with the specified Items of User*
 * @param {string} userId
 * @param {string} itemName
 */
function findUserItemEntry(userId, itemName) {
	return db.models.Item.findOne({ where: { userId, itemName } });
}

module.exports = {
	setDB,
	getInventory,
	findUserItemEntry
}
