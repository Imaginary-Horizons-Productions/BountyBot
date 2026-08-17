import { InteractionContextType, PermissionFlagsBits } from 'discord.js';
import type { LogicLayer } from '../../../logic';
import { CommandFunctionality } from '../../classes';
import { aggregateSubcommands } from '../../shared';

let logicLayer: LogicLayer;

const mainId = "create-default";
const { slashData: subcommandSlashData, executeDictionary: subcommandExecuteDictionary } = await aggregateSubcommands(mainId, [
	"bounty-board-forum.js",
	"scoreboard-reference.js",
	"rank-roles.js"
]);
export default new CommandFunctionality(mainId, "Create a Discord resource for use by BountyBot", PermissionFlagsBits.ManageChannels, false, [InteractionContextType.Guild], 30000,
	(interaction, theater, isDevMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, theater, isDevMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandSlashData);
