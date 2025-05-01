const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { MessageContextMenuWrapper } = require('../classes');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "";
module.exports = new MessageContextMenuWrapper(mainId, null, false, [InteractionContextType.Guild], 3000,
	/** Specs */
	(interaction, runMode) => {

	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
