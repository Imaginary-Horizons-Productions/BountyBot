const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { UserContextMenuWrapper } = require('../classes');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "";
module.exports = new UserContextMenuWrapper(mainId, null, false, [InteractionContextType.Guild], 3000,
	/** Specs */
	(interaction, runMode) => {

	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
