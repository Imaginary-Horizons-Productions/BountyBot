const { CommandInteraction } = require("discord.js");
const { Item, Colorizer } = require("../classes");
const { Sequelize } = require("sequelize");

/** @type {Record<string, Item>} */
const ITEMS = {};
/** @type {string[]} */
const ITEM_NAMES = [];

for (const file of [
	"bonus-bounty-showcase.js",
	"bounty-thumbnail.js",
	"goal-initializer.js",
	"loot-box.js",
	"progress-in-a-can.js",
	"unidentified-item.js",
	"xp-boost-epic.js",
	"xp-boost-legendary.js",
	"xp-boost.js"
]) {
	/** @type {Item} */
	const item = require(`./${file}`);
	ITEMS[item.name] = item;
	ITEM_NAMES.push(item.name);
}

const colors = [
	'Aqua',
	'Blue',
	'Blurple',
	'Dark Aqua',
	'Dark Blue',
	'Dark But Not Black',
	'Darker Grey',
	'Dark Gold',
	'Dark Green',
	'Dark Grey',
	'Dark Navy',
	'Dark Orange',
	'Dark Purple',
	'Dark Red',
	'Dark Vivid Pink',
	'Default',
	'Fuchsia',
	'Gold',
	'Green',
	'Grey',
	'Greyple',
	'Light Grey',
	'Luminous Vivid Pink',
	'Navy',
	'Not Quite Black',
	'Orange',
	'Purple',
	'Red',
	'White',
	'Yellow'
];

const colorizerItems = colors.map(color => new Colorizer(color));
colorizerItems.forEach(colorizer => {
	ITEMS[colorizer.name] = colorizer;
	ITEM_NAMES.push(colorizer.name);
});

/** @param {string[]} exclusions */
exports.getItemNames = function (exclusions) {
	return ITEM_NAMES.filter(name => !exclusions.includes(name));
}

/** @param {string} itemName */
exports.getItemDescription = function (itemName) {
	return ITEMS[itemName].description;
}

/** @param {string} itemName */
exports.getItemCooldown = function (itemName) {
	return ITEMS[itemName].cooldown;
}

/**
 * @param {string} itemName
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @returns {Promise<boolean>} whether to skip decrementing the item count
 */
exports.useItem = function (itemName, interaction, database) {
	return ITEMS[itemName].effect(interaction, database);
}

exports.setLogic = function (logicBlob) {
	for (const itemKey in ITEMS) {
		ITEMS[itemKey].setLogic?.(logicBlob);
	}
}
