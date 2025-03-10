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

/** *Grants the User 1 copy of the specified Item*
 * @param {string} userId
 * @param {string} itemName
 */
function grantItem(userId, itemName) {
	return db.models.Item.findOrCreate({ where: { userId, itemName } }).then(([itemRow, itemWasCreated]) => {
		if (!itemWasCreated) {
			itemRow.increment("count");
		}
		return;
	});
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
	grantItem,
	findUserItemEntry
}
