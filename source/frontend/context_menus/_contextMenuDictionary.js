const { ContextMenuWrapper } = require("../classes");

/** @type {string[]} */
exports.contextMenuFiles = [
	"BountyBot_Stats.js",
	"Raise_a_Toast.js",
	"Record_Bounty_Turn-In.js"
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
