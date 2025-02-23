const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { createSubcommandMappings } = require('../../util/fileUtil.js');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "create-default";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, [
	"bountyboardforum.js",
	"scoreboardreference.js",
	"rankroles.js"
]);
module.exports = new CommandWrapper(mainId, "Create a Discord resource for use by BountyBot", PermissionFlagsBits.ManageChannels, false, [InteractionContextType.Guild], 30000,
	(interaction, database, runMode) => {
		logicLayer.companies.findOrCreateCompany(interaction.guild.id).then(([company]) => {
			subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, database, runMode, company);
		});
	}
).setSubcommands(subcommandSlashData);

module.exports.setLogic = (logicBlob) => {
	logicLayer = logicBlob;
}
