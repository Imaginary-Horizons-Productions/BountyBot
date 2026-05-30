import { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import { CooldownDictionary, PremiumCommandList } from '../../shared/types';
import { type CommandWrapper, BuildError } from '../classes';

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
const commandDictionary: Record<string, CommandWrapper> = {};
export const slashData: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

for (const file of exports.commandFiles) {
	//TODONOW refactor - require no longer supported
	const command = require(`./${file}`);
	if (command.mainId in commandDictionary) {
		throw new BuildError(`Duplicate command custom id: ${command.mainId}`);
	}
	commandDictionary[command.mainId] = command;
	exports.slashData.push(command.builder.toJSON());
}

export function getCommand(commandName: string) {
	return commandDictionary[commandName];
}

export function setLogic(logicBlob: typeof import("../../logic")) {
	for (const commandKey in commandDictionary) {
		commandDictionary[commandKey].setLogic?.(logicBlob);
	}
}

export function addEntriesToCooldownDictionary(cooldownDictionary: CooldownDictionary) {
	for (const commandKey in commandDictionary) {
		cooldownDictionary[commandKey] = commandDictionary[commandKey].cooldown;
	}
}

export function addToPremiumList(list: PremiumCommandList) {
	for (const commandKey in commandDictionary) {
		if (commandDictionary[commandKey].premiumCommand) {
			list.push(commandKey);
		}
	}
}
