const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { createSubcommandMappings } = require('../../util/configUtil');

const mainId = "festival";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, [
	"start.js",
	"close.js"
]);
module.exports = new CommandWrapper(mainId, "Manage a server-wide festival to multiply XP of bounty completions, toast reciepts, and crit toasts", PermissionFlagsBits.ManageGuild, true, false, 3000,
	/** Allow users to manage an XP multiplier festival */
	(interaction, database, runMode) => {
		database.models.Company.findOrCreate({ where: { id: interaction.guildId } }).then(([company]) => {
			subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, database, runMode, company);
		});
	}
).setSubcommands(subcommandSlashData);
