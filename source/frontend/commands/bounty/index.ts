import { InteractionContextType, PermissionFlagsBits } from 'discord.js';
import type { LogicLayer } from '../../../logic';
import { CommandFunctionality } from '../../classes';
import { aggregateSubcommands } from '../../shared';

let logicLayer: LogicLayer;

const mainId = "bounty";
const { subcommandBuilders, executeDictionary: subcommandExecuteDictionary } = await aggregateSubcommands(mainId, [
	"complete.js",
	"edit.js",
	"list.js",
	"ping.js",
	"post.js",
	"record-turn-ins.js",
	"revoke-turn-ins.js",
	"showcase.js",
	"swap.js",
	"take-down.js",
]);
export default new CommandFunctionality(mainId, "Bounties are user-created objectives for other server members to complete", PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 3000,
	async (interaction, theater, isDevMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, theater, isDevMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandBuilders);
