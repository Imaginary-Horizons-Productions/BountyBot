import { InteractionContextType, PermissionFlagsBits } from 'discord.js';
import type { LogicLayer } from '../../../logic';
import { CommandFunctionality } from '../../classes/index.ts';
import { aggregateSubcommands } from '../../shared/index.ts';

let logicLayer: LogicLayer;

const mainId = "raffle";
const { subcommandBuilders, executeDictionary: subcommandExecuteDictionary } = await aggregateSubcommands(mainId, [
	"announce-upcoming.ts",
	"by-level.ts",
	"by-rank.ts"
]);
export default new CommandFunctionality(mainId, "Randomly select a bounty hunter from a variety of pools", PermissionFlagsBits.ManageGuild, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	(interaction, theater, isDevMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, theater, isDevMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandBuilders);
