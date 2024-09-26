const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { createSubcommandMappings } = require('../../util/fileUtil.js');

const mainId = "evergreen";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, [
	"post.js",
	"edit.js",
	"swap.js",
	"showcase.js",
	"complete.js",
	"takedown.js"
]);
module.exports = new CommandWrapper(mainId, "Evergreen Bounties are not closed after completion; ideal for server-wide objectives", PermissionFlagsBits.ManageChannels, true, [InteractionContextType.Guild], 3000,
	(interaction, database, runMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, database, runMode);
	}
).setSubcommands(subcommandSlashData);
