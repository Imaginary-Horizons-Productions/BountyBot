import { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import { LogicLayer } from '../../logic';
import { CooldownDictionary, PremiumFlowList } from '../../shared/types';
import { type CommandFunctionality, BuildError } from '../classes';

export const commandFiles = [
	"about.js",
	"bounty", //TODONOW providing directory name doesn't short cut to index.js in module, right?
	"commands.js",
	"config-premium.js",
	"config-server-thumbnails-premium.js",
	"config-user-thumbnails-premium.js",
	"config-server.js",
	"create-default",
	"data-policy.js",
	"evergreen",
	"feedback.js",
	"festival",
	"inventory.js",
	"item.js",
	"moderation",
	"premium.js",
	"raffle",
	"rank",
	"reset",
	"scoreboard.js",
	"season-end.js",
	"seasonal-ranks",
	"stats.js",
	"toast.js",
	"tutorial.js",
	"version.js"
];
const COMMAND_FUNCTIONALITIES = new Map<string, CommandFunctionality>();
export const slashData: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

for (const file of exports.commandFiles) {
	const command: CommandFunctionality = (await import(`./${file}`)).default;
	if (COMMAND_FUNCTIONALITIES.has(command.mainId)) {
		throw new BuildError(`Duplicate command mainId: ${command.mainId}`);
	}
	COMMAND_FUNCTIONALITIES.set(command.mainId, command);
	slashData.push(command.builder.toJSON());
}

export function getCommand(mainId: string) {
	const functionality = COMMAND_FUNCTIONALITIES.get(mainId);
	if (!functionality) {
		throw new Error(`Missing CommandFunctionality: ${mainId}`);
	}
	return functionality;
}

export function linkAllCommandsToLogic(logicBlob: LogicLayer) {
	for (const functionality of COMMAND_FUNCTIONALITIES.values()) {
		functionality.linkToLogic?.(logicBlob);
	}
}

export function addCommandsToCooldownDictionary(cooldownDictionary: CooldownDictionary) {
	for (const [mainId, functionality] of COMMAND_FUNCTIONALITIES) {
		cooldownDictionary[mainId] = functionality.cooldown;
	}
}

export function addCommandsToPremiumList(list: PremiumFlowList) {
	for (const [mainId, functionality] of COMMAND_FUNCTIONALITIES) {
		if (functionality.isPremium) {
			list.push(mainId);
		}
	}
}
