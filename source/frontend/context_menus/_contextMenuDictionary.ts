import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";

import { CooldownDictionary, PremiumFlowList } from "../../shared/types";
import { BuildError, type ContextMenuWrapper } from "../classes";

export const contextMenuFiles: string[] = [
	"BountyBot_Stats.js",
	"Raise_a_Toast.js",
	"Record_Bounty_Turn-In.js"
];

const contextMenuDictionary: Record<string, ContextMenuWrapper> = {};
export const contextMenuData: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

for (const file of exports.contextMenuFiles) {
	//TODONOW refactor - require no longer supported
	const contextMenu = require(`./${file}`);
	if (contextMenu.mainId in contextMenuDictionary) {
		throw new BuildError(`Duplicate context menu custom id: ${contextMenu.mainId}`)
	}
	contextMenuDictionary[contextMenu.mainId] = contextMenu;
	exports.contextMenuData.push(contextMenu.builder.toJSON());
}

export function getContextMenu(mainId: string) {
	return contextMenuDictionary[mainId];
}

export function setLogic(logicBlob: typeof import("../../logic")) {
	for (const contextMenuKey in contextMenuDictionary) {
		contextMenuDictionary[contextMenuKey].setLogic?.(logicBlob);
	}
}

export function addEntriesToCooldownDictionary(cooldownDictionary: CooldownDictionary) {
	for (const commandKey in contextMenuDictionary) {
		cooldownDictionary[commandKey] = contextMenuDictionary[commandKey].cooldown;
	}
}

export function addToPremiumList(list: PremiumFlowList) {
	for (const commandKey in contextMenuDictionary) {
		if (contextMenuDictionary[commandKey].premiumCommand) {
			list.push(commandKey);
		}
	}
}
