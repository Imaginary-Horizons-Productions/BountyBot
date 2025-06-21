const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../../classes');
const { createSubcommandMappings } = require('../../shared');

/** @type {typeof import("../../../logic")} */
let logicLayer;

const mainId = "moderation";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = createSubcommandMappings(mainId, [
	"bountybot-ban.js",
	"gp-penalty.js",
	"revoke-goal-bonus.js",
	"season-disqualify.js",
	"take-down.js",
	"user-report.js",
	"xp-penalty.js"
]);
module.exports = new CommandWrapper(mainId, "BountyBot moderation tools", PermissionFlagsBits.ManageRoles, false, [InteractionContextType.Guild], 3000,
	(interaction, origin, runMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, origin, runMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
