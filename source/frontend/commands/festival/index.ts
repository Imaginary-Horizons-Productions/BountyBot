import { InteractionContextType, PermissionFlagsBits } from 'discord.js';
import type { LogicLayer } from '../../../logic';
import { CommandFunctionality } from '../../classes';
import { aggregateSubcommands } from '../../shared';

let logicLayer: LogicLayer;

const mainId = "festival";
const { subcommandBuilders, executeDictionary: subcommandExecuteDictionary } = await aggregateSubcommands(mainId, [
	"start-gp.js",
	"start-xp.js",
	"close-gp.js",
	"close-xp.js"
]);
export default new CommandFunctionality(mainId, "Manage a server-wide festival to multiply XP of bounty completions, toast reciepts, and crit toasts", PermissionFlagsBits.ManageGuild, true, [InteractionContextType.Guild], 3000,
	/** Allow users to manage an XP multiplier festival */
	(interaction, theater, isDevMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, theater, isDevMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandBuilders);
