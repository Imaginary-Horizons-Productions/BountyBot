const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { createSubcommandMappings } = require('../../util/fileUtil.js');

const mainId = "moderation";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, [
	"bountybotban.js",
	"gppenalty.js",
	"revokegoalbonus.js",
	"seasondisqualify.js",
	"takedown.js",
	"userreport.js",
	"xppenalty.js"
]);
module.exports = new CommandWrapper(mainId, "BountyBot moderation tools", PermissionFlagsBits.ManageRoles, false, [InteractionContextType.Guild], 3000,
	(interaction, database, runMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, database, runMode);
	}
).setSubcommands(subcommandSlashData);
