import { InteractionContextType, PermissionFlagsBits } from 'discord.js';
import type { LogicLayer } from '../../../logic';
import { CommandFunctionality } from '../../classes';
import { aggregateSubcommands } from '../../shared';

let logicLayer: LogicLayer;

const mainId = "raffle";
const { subcommandBuilders, executeDictionary: subcommandExecuteDictionary } = await aggregateSubcommands(mainId, [
	"announce-upcoming.js",
	"by-level.js",
	"by-rank.js"
]);
export default new CommandFunctionality(mainId, "Randomly select a bounty hunter from a variety of pools", PermissionFlagsBits.ManageGuild, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	(interaction, theater, isDevMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, theater, isDevMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandBuilders);
