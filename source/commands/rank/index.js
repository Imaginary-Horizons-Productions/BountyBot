const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { createSubcommandMappings } = require('../../util/configUtil');

const mainId = "rank";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, [
	"info.js",
	"add.js",
	"edit.js",
	"remove.js"
]);
module.exports = new CommandWrapper(mainId, "Seasonal Ranks distinguish bounty hunters who have above average season XP", PermissionFlagsBits.ManageRoles, true, false, 3000,
	(interaction, database, runMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, database, runMode);
	}
).setSubcommands(subcommandSlashData);
