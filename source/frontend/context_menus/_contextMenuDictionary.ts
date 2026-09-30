import type { RESTPostAPIContextMenuApplicationCommandsJSONBody } from "discord.js";
import type { LogicLayer } from "../../logic";
import type { CooldownDictionary, PremiumFlowList } from "../../shared/types.ts";
import { BuildError, type ContextMenuFunctionality } from "../classes/index.ts";

export const contextMenuFiles: string[] = [
	"./BountyBot_Stats.ts",
	"./Raise_a_Toast.ts",
	"./Record_Bounty_Turn-In.ts"
];

const CONTEXT_MENU_FUNCTIONALITIES = new Map<string, ContextMenuFunctionality>();
export const contextMenuData: RESTPostAPIContextMenuApplicationCommandsJSONBody[] = [];

for (const file of contextMenuFiles) {
	const contextMenu: ContextMenuFunctionality = (await import(`./${file}`)).default;
	if (CONTEXT_MENU_FUNCTIONALITIES.has(contextMenu.mainId)) {
		throw new BuildError(`Duplicate context menu mainId: ${contextMenu.mainId}`)
	}
	CONTEXT_MENU_FUNCTIONALITIES.set(contextMenu.mainId, contextMenu);
	contextMenuData.push(contextMenu.builder.toJSON());
}

export function getContextMenu(mainId: string) {
	const functionality = CONTEXT_MENU_FUNCTIONALITIES.get(mainId);
	if (!functionality) {
		throw new Error(`Missing ContextMenuFunctionality: ${mainId}`);
	}
	return functionality;
}

export function linkAllContextMenusToLogic(logicBlob: LogicLayer) {
	for (const functionality of CONTEXT_MENU_FUNCTIONALITIES.values()) {
		functionality.linkToLogic?.(logicBlob);
	}
}

export function addContextMenusToCooldownDictionary(cooldownDictionary: CooldownDictionary) {
	for (const [mainId, functionality] of CONTEXT_MENU_FUNCTIONALITIES) {
		cooldownDictionary[mainId] = functionality.cooldown;
	}
}

export function addContextMenusToPremiumList(list: PremiumFlowList) {
	for (const [mainId, functionality] of CONTEXT_MENU_FUNCTIONALITIES) {
		if (functionality.isPremium) {
			list.push(mainId);
		}
	}
}
