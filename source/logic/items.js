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

module.exports = {
	setDB,
	getInventory
}
