const { Sequelize, Op } = require("sequelize");
const { dateInPast } = require("../shared");
const { premium } = require("../constants");
const { Item, Hunter } = require("../database/models");

/** @type {Sequelize} */
let db;

/** *Set the database pointer for the Item logic file*
 * @param {Sequelize} database
 */
function setDB(database) {
	db = database;
}

/** @param {string} userId */
async function getInventory(userId) {
	/** @type {Map<string, number>} */
	const inventoryMap = new Map();
	for(const item of await db.models.Item.findAll({ where: { userId, used: false } })) {
		if (inventoryMap.has(item.itemName)) {
			inventoryMap.set(item.itemName, inventoryMap.get(item.itemName) + 1);
		} else {
			inventoryMap.set(item.itemName, 1);
		}
	}
	return inventoryMap;
}


/** pool picker range: 0-120
 * @type {Record<number, string[]>} key as theshold to get to pool defined by string array
 */
const DROP_TABLE = {
	70: [
		"Bonus Bounty Showcase",
		"Bounty Thumbnail",
		"Goal Initializer",
		"Progress-in-a-Can",
		"XP Boost"
	],
	0: [
		"Aqua Profile Colorizer",
		"Blue Profile Colorizer",
		"Blurple Profile Colorizer",
		"Dark Aqua Profile Colorizer",
		"Dark Blue Profile Colorizer",
		"Dark But Not Black Profile Colorizer",
		"Darker Grey Profile Colorizer",
		"Dark Gold Profile Colorizer",
		"Dark Green Profile Colorizer",
		"Dark Grey Profile Colorizer",
		"Dark Navy Profile Colorizer",
		"Dark Orange Profile Colorizer",
		"Dark Purple Profile Colorizer",
		"Dark Red Profile Colorizer",
		"Dark Vivid Pink Profile Colorizer",
		"Default Profile Colorizer",
		"Fuchsia Profile Colorizer",
		"Gold Profile Colorizer",
		"Green Profile Colorizer",
		"Grey Profile Colorizer",
		"Greyple Profile Colorizer",
		"Light Grey Profile Colorizer",
		"Luminous Vivid Pink Profile Colorizer",
		"Orange Profile Colorizer",
		"Purple Profile Colorizer",
		"Red Profile Colorizer",
		"White Profile Colorizer",
		"Yellow Profile Colorizer",
	]
};

/** @param {string} hunterId */
async function getDropsAvailable(hunterId) {
	const itemCutoff = premium.gift.concat(premium.paid).includes(hunterId) ? 4 : 2;
	const itemsDropped = await db.models.Item.count({ where: { userId: hunterId, updatedAt: { [Op.gt]: dateInPast({ 'd': 1 }) } } });
	return itemCutoff - itemsDropped;
}

/** *Grants the User 1 copy of a random Item at a rate of dropRate*
 * @param {number} dropRate a decimal between 0 and 1 (exclusive)
 * @param {Hunter} hunter
 * @returns {Promise<[itemRow: Item | null, wasCreated: boolean]>}
 */
async function rollItemForHunter(dropRate, hunter) {
	if (hunter.itemFindBoost) {
		dropRate *= 2;
		hunter.update("itemFindBoost", false);
	}

	let droppedItem;
	if (Math.random() < dropRate) {
		const poolThresholds = Object.keys(DROP_TABLE).map(unparsed => parseFloat(unparsed)).sort((a, b) => b - a);
		const poolRandomNumber = Math.random() * 120;
		for (const threshold of poolThresholds) {
			if (poolRandomNumber > threshold) {
				const pool = DROP_TABLE[threshold];
				droppedItem = pool[Math.floor(Math.random() * pool.length)];
			}
		}
	}
	if (!droppedItem) return [null, false];

	return db.models.Item.findOrCreate({ where: { userId: hunter.userId, itemName: droppedItem } }).then((result) => {
		const [itemRow, itemWasCreated] = result;
		if (!itemWasCreated) {
			itemRow.increment("count");
		}
		return result;
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
	getDropsAvailable,
	rollItemForHunter,
	findUserItemEntry
}
