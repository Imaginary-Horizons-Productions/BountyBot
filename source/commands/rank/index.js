const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { createSubcommandMappings } = require('../../util/fileUtil.js');

const mainId = "rank";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, [
	"add.js",
	"edit.js",
	"remove.js"
]);
module.exports = new CommandWrapper(mainId, "Seasonal Ranks distinguish bounty hunters who have above average season XP", PermissionFlagsBits.ManageRoles, true, [InteractionContextType.Guild], 3000,
	(interaction, runMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, runMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
