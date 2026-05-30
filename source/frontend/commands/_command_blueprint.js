const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { aggregateSubcommands } = require('../shared');

/** @type {import('../../shared/types').LogicLayer} */
let logicLayer;

const mainId = "";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = aggregateSubcommands(mainId, []);
module.exports = new CommandWrapper(mainId, "description", PermissionFlagsBits.ViewChannel, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	/** Command specifications go here */
	(interaction, origin, isDevMode) => {

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
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
