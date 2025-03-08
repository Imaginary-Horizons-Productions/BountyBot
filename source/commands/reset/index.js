const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { createSubcommandMappings } = require('../../util/fileUtil.js');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "reset";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, [
	"allhunterstats.js",
	"serversettings.js"
]);
module.exports = new CommandWrapper(mainId, "Reset all bounty hunter stats, bounties, or server configs", PermissionFlagsBits.ManageGuild, false, [InteractionContextType.Guild], 3000,
	(interaction, database, runMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, database, runMode, logicLayer);
	}
).setSubcommands(subcommandSlashData)
	.setLogicLinker(logicBlob => {
		logicLayer = logicBlob;
	});
