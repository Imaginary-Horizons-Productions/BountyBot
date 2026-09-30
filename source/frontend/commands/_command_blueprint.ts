import { InteractionContextType, PermissionFlagsBits, SlashCommandStringOption } from 'discord.js';
import type { LogicLayer } from '../../logic';
import { CommandFunctionality } from '../classes/index.ts';
import { aggregateSubcommands } from '../shared/index.ts';

let logicLayer: LogicLayer;

const commandOption = new SlashCommandStringOption();

const mainId = "";
const { subcommandBuilders, executeDictionary: subcommandExecuteDictionary } = await aggregateSubcommands(mainId, []);
export default new CommandFunctionality(mainId, "description", PermissionFlagsBits.ViewChannel, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	/** Command specifications go here */
	(interaction, origin, isDevMode) => {

	}
).setOptions(
	commandOption
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandBuilders);
