const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { createSubcommandMappings } = require('../util/fileUtil.js');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, []);
module.exports = new CommandWrapper(mainId, "description", PermissionFlagsBits.ViewChannel, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	/** Command specifications go here */
	(interaction, database, runMode) => {

	}
).setOptions(
	{
		type: "",
		name: "",
		description: "",
		required: false,
		autocomplete: [{ name: "", value: "" }], // optional
		choices: [{ name: "", value: "" }] // optional
	}
).setSubcommands(subcommandSlashData)
.setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
