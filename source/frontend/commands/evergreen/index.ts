import { InteractionContextType, PermissionFlagsBits } from 'discord.js';
import type { LogicLayer } from '../../../logic';
import { CommandFunctionality } from '../../classes';
import { aggregateSubcommands } from '../../shared';

let logicLayer: LogicLayer;

const mainId = "evergreen";
const { subcommandBuilders, executeDictionary: subcommandExecuteDictionary } = await aggregateSubcommands(mainId, [
	"post.js",
	"edit.js",
	"swap.js",
	"showcase.js",
	"complete.js",
	"take-down.js"
]);
module.exports = new CommandFunctionality(mainId, "Evergreen Bounties are not closed after completion; ideal for server-wide objectives", PermissionFlagsBits.ManageChannels, true, [InteractionContextType.Guild], 3000,
	(interaction, theater, isDevMode) => {
		subcommandExecuteDictionary[interaction.options.getSubcommand()](interaction, theater, isDevMode, logicLayer);
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
}).setSubcommands(subcommandBuilders);
