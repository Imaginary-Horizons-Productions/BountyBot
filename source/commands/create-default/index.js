const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { createSubcommandMappings } = require('../../util/fileUtil.js');

const mainId = "create-default";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, [
	"bountyboardforum.js",
	"scoreboardreference.js",
	"rankroles.js"
]);
module.exports = new CommandWrapper(mainId, "Create a Discord resource for use by BountyBot", PermissionFlagsBits.ManageChannels, false, false, 30000,
	(interaction, database, runMode) => {
		database.models.Company.findOrCreate({ where: { id: interaction.guildId } }).then(([company]) => {
			subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, database, runMode, company);
		});
	}
).setSubcommands(subcommandSlashData);
