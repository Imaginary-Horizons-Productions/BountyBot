const { ContextMenuWrapper } = require("../classes");

/** @type {string[]} */
exports.contextMenuFiles = [
	"BountyBot_Stats.js",
	"Give_Bounty_Credit.js",
	"Raise_a_Toast.js"
];
/** @type {Record<string, ContextMenuWrapper>} */
const contextMenuDictionary = {};
/** @type {import('discord.js').RESTPostAPIChatInputApplicationCommandsJSONBody[]} */
exports.contextMenuData = [];

for (const file of exports.contextMenuFiles) {
	/** @type {ContextMenuWrapper} */
	const contextMenu = require(`./${file}`);
	if (contextMenu.mainId in contextMenuDictionary) {
		throw new BuildError(`Duplicate context menu custom id: ${contextMenu.mainId}`)
	}
	contextMenuDictionary[contextMenu.mainId] = contextMenu;
	exports.contextMenuData.push(contextMenu.builder.toJSON());
}

/** @param {string} mainId */
exports.getContextMenu = function (mainId) {
	return contextMenuDictionary[mainId];
}

exports.setLogic = function (logicBlob) {
	for (const contextMenuKey in contextMenuDictionary) {
		contextMenuDictionary[contextMenuKey].setLogic?.(logicBlob);
	}
}

exports.updateCooldownMap = function(map) {
	for (const commandKey in contextMenuDictionary) {
		map[commandKey] = contextMenuDictionary[commandKey].cooldown;
	}
}

exports.updatePremiumList = function(list) {
	for (const commandKey in contextMenuDictionary) {
		if (contextMenuDictionary[commandKey].premiumCommand) {
			list.push(commandKey);
		}
	}
}