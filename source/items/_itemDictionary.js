const { CommandInteraction } = require("discord.js");
const { Item } = require("../classes");
const { Sequelize } = require("sequelize");

/** @type {Record<string, Item>} */
const ITEMS = {};
/** @type {string[]} */
const ITEM_NAMES = [];

for (const file of [
	"bonus-bounty-showcase.js",
	"bounty-thumbnail.js",
	"loot-box.js",
	"profile-colorizer-aqua.js",
	"profile-colorizer-blue.js",
	"profile-colorizer-blurple.js",
	"profile-colorizer-darkaqua.js",
	"profile-colorizer-darkblue.js",
	"profile-colorizer-darkbutnotblack.js",
	"profile-colorizer-darkergrey.js",
	"profile-colorizer-darkgold.js",
	"profile-colorizer-darkgreen.js",
	"profile-colorizer-darkgrey.js",
	"profile-colorizer-darknavy.js",
	"profile-colorizer-darkorange.js",
	"profile-colorizer-darkpurple.js",
	"profile-colorizer-darkred.js",
	"profile-colorizer-darkvividpink.js",
	"profile-colorizer-default.js",
	"profile-colorizer-fuchsia.js",
	"profile-colorizer-gold.js",
	"profile-colorizer-green.js",
	"profile-colorizer-grey.js",
	"profile-colorizer-lightgrey.js",
	"profile-colorizer-luminousvividpink.js",
	"profile-colorizer-navy.js",
	"profile-colorizer-notquiteblack.js",
	"profile-colorizer-orange.js",
	"profile-colorizer-purple.js",
	"profile-colorizer-red.js",
	"profile-colorizer-white.js",
	"profile-colorizer-yellow.js",
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
