import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import type { LogicLayer } from '../../logic';
import type { CooldownDictionary, PremiumFlowList } from '../../shared/types.ts';
import { type CommandFunctionality, BuildError } from '../classes/index.ts';

export const commandFiles = [
	"./bounty/index.ts",
	"./create-default/index.ts",
	"./evergreen/index.ts",
	"./festival/index.ts",
	"./moderation/index.ts",
	"./raffle/index.ts",
	"./rank/index.ts",
	"./reset/index.ts",
	"./about.ts",
	"./commands.ts",
	"./config-premium.ts",
	"./config-server-thumbnails-premium.ts",
	"./config-user-thumbnails-premium.ts",
	"./config-server.ts",
	"./data-policy.ts",
	"./feedback.ts",
	"./inventory.ts",
	"./item.ts",
	"./premium.ts",
	"./scoreboard.ts",
	"./season-end.ts",
	"./seasonal-ranks.ts",
	"./stats.ts",
	"./toast.ts",
	"./tutorial.ts",
	"./version.ts"
];
const COMMAND_FUNCTIONALITIES = new Map<string, CommandFunctionality>();
export const slashData: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

for (const file of commandFiles) {
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
