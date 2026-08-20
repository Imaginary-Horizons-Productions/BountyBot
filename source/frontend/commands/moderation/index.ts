import { InteractionContextType, PermissionFlagsBits } from 'discord.js';
import type { LogicLayer } from '../../../logic';
import { CommandFunctionality } from '../../classes';
import { aggregateSubcommands } from '../../shared';

let logicLayer: LogicLayer;

const mainId = "moderation";
const { subcommandBuilders, executeDictionary: subcommandExecuteDictionary } = await aggregateSubcommands(mainId, [
	"bountybot-ban.js",
	"gp-penalty.js",
	"revoke-goal-bonus.js",
	"season-disqualify.js",
	"take-down.js",
	"user-report.js",
	"xp-penalty.js"
]);
export default new CommandFunctionality(mainId, "BountyBot moderation tools", PermissionFlagsBits.ManageRoles, false, [InteractionContextType.Guild], 3000,
	(interaction, theater, isDevMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, theater, isDevMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandBuilders);
