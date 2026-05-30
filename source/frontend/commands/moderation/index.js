const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { aggregateSubcommands } = require('../../shared');

/** @type {import('../../../shared/types').LogicLayer} */
let logicLayer;

const mainId = "moderation";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = aggregateSubcommands(mainId, [
	"bountybot-ban.js",
	"gp-penalty.js",
	"revoke-goal-bonus.js",
	"season-disqualify.js",
	"take-down.js",
	"user-report.js",
	"xp-penalty.js"
]);
module.exports = new CommandWrapper(mainId, "BountyBot moderation tools", PermissionFlagsBits.ManageRoles, false, [InteractionContextType.Guild], 3000,
	(interaction, theater, isDevMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, theater, isDevMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
