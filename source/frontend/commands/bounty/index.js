const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { aggregateSubcommands } = require('../../shared');

/** @type {typeof import("../../../logic")} */
let logicLayer;

const mainId = "bounty";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = aggregateSubcommands(mainId, [
	"complete.js",
	"edit.js",
	"list.js",
	"post.js",
	"record-turn-ins.js",
	"revoke-turn-ins.js",
	"showcase.js",
	"swap.js",
	"take-down.js",
]);
module.exports = new CommandWrapper(mainId, "Bounties are user-created objectives for other server members to complete", PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	async (interaction, origin, runMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, origin, runMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
