const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { createSubcommandMappings } = require('../../util/fileUtil.js');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "raffle";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, [
	"./byrank.js",
	"./bylevel.js",
	"./announceupcoming.js"
]);
module.exports = new CommandWrapper(mainId, "Randomly select a bounty hunter from a variety of pools", PermissionFlagsBits.ManageGuild, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	(interaction, database, runMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, database, runMode, logicLayer);
	}
).setSubcommands(subcommandSlashData)
	.setLogicLinker(logicBlob => {
		logicLayer = logicBlob;
	});
