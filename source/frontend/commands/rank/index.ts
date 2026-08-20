import { InteractionContextType, PermissionFlagsBits } from 'discord.js';
import type { LogicLayer } from '../../../logic';
import { CommandFunctionality } from '../../classes';
import { aggregateSubcommands } from '../../shared';

let logicLayer: LogicLayer;

const mainId = "rank";
const { subcommandBuilders, executeDictionary: subcommandExecuteDictionary } = await aggregateSubcommands(mainId, [
	"add.js",
	"edit.js",
	"remove.js"
]);
export default new CommandFunctionality(mainId, "Seasonal Ranks distinguish bounty hunters who have above average season XP", PermissionFlagsBits.ManageRoles, true, [InteractionContextType.Guild], 3000,
	(interaction, theater, isDevMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, theater, isDevMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandBuilders);
