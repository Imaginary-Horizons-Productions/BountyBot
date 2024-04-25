const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { createSubcommandMappings } = require('../util/fileUtil.js');

const mainId = "";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, []);
module.exports = new CommandWrapper(mainId, "description", PermissionFlagsBits.ViewChannel, false, true, 3000,
	/** Command specifications go here */
	(interaction, database, runMode) => {

	}
).setOptions(
	{
		type: "",
		name: "",
		description: "",
		required: false,
		autocompleteFilter: (interaction, database) => { return [{ name: "", value: "" }] }, // optional
		choices: [{ name: "", value: "" }] // optional
	}
).setSubcommands(subcommandSlashData);
