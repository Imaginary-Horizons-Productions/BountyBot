import { InteractionContextType, PermissionFlagsBits } from 'discord.js';
import type { LogicLayer } from '../../../logic';
import { CommandFunctionality } from '../../classes/index.ts';
import { aggregateSubcommands } from '../../shared/index.ts';

let logicLayer: LogicLayer;

const mainId = "reset";
const { subcommandBuilders, executeDictionary: subcommandExecuteDictionary } = await aggregateSubcommands(mainId, [
	"all-hunter-stats.ts",
	"server-settings.ts"
]);
export default new CommandFunctionality(mainId, "Reset all bounty hunter stats, bounties, or server configs", PermissionFlagsBits.ManageGuild, false, [InteractionContextType.Guild], 3000,
	(interaction, theater, isDevMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, theater, isDevMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandBuilders);
