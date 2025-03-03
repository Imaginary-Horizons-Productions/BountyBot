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
	db.models.Item.findOrCreate({ where: { userId, itemName } }).then(([itemRow, itemWasCreated]) => {
		if (!itemWasCreated) {
			itemRow.increment("count");
		}
	});
}

module.exports = {
	setDB,
	getInventory,
	grantItem
}
