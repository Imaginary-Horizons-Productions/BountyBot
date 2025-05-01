const { CommandInteraction } = require("discord.js");
const { ItemTemplateSet, ItemTemplate } = require("../classes");

/** @type {Record<string, ItemTemplate>} */
const ITEMS = {};
/** @type {((logicBlob: typeof import("../logic")) => void)[]} */
const ITEM_LOGIC_SETTERS = [];
/** @type {string[]} */
const ITEM_NAMES = [];

for (const file of [
	"bonus-bounty-showcase.js",
	"bounty-thumbnail.js",
	"colorizers.js",
	"goal-initializer.js",
	"loot-box.js",
	"progress-in-a-can.js",
	"unidentified-item.js",
	"xp-boost-epic.js",
	"xp-boost-legendary.js",
	"xp-boost.js"
]) {
	/** @type {ItemTemplateSet} */
	const itemTemplateSet = require(`./${file}`);
	ITEM_LOGIC_SETTERS.push(itemTemplateSet.setLogic);
	for (const item of itemTemplateSet.items) {
		ITEMS[item.name] = item;
		ITEM_NAMES.push(item.name);
	}
}

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
 * @returns {Promise<boolean>} whether to skip decrementing the item count
 */
exports.useItem = function (itemName, interaction) {
	return ITEMS[itemName].effect(interaction);
}

exports.setLogic = function (logicBlob) {
	for (const setter of ITEM_LOGIC_SETTERS) {
		setter(logicBlob);
	}
}
