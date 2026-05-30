const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandFunctionality } = require('../../classes');
const { aggregateSubcommands } = require('../../shared');

/** @type {import('../../../shared/types').LogicLayer} */
let logicLayer;

const mainId = "bounty";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = aggregateSubcommands(mainId, [
	"complete.js",
	"edit.js",
	"list.js",
	"ping.js",
	"post.js",
	"record-turn-ins.js",
	"revoke-turn-ins.js",
	"showcase.js",
	"swap.js",
	"take-down.js",
]);
module.exports = new CommandFunctionality(mainId, "Bounties are user-created objectives for other server members to complete", PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	async (interaction, theater, isDevMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, theater, isDevMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
