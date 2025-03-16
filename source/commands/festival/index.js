const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { createSubcommandMappings } = require('../../util/fileUtil.js');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "festival";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, [
	"start.js",
	"close.js"
]);
module.exports = new CommandWrapper(mainId, "Manage a server-wide festival to multiply XP of bounty completions, toast reciepts, and crit toasts", PermissionFlagsBits.ManageGuild, true, [InteractionContextType.Guild], 3000,
	/** Allow users to manage an XP multiplier festival */
	(interaction, runMode) => {
		logicLayer.companies.findOrCreateCompany(interaction.guild.id).then(([company]) => {
			subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, runMode, logicLayer, company);
		});
	}
).setSubcommands(subcommandSlashData)
	.setLogicLinker(logicBlob => {
		logicLayer = logicBlob;
	});
