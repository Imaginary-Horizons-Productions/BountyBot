import { ButtonInteraction } from "discord.js";
import type { LogicLayer } from "../../logic";
import type { CooldownDictionary } from "../../shared/types.ts";
import type { InteractionTheater, ItemTemplate, ItemTemplateSet } from "../classes/index.ts";

const ITEMS: Record<string, ItemTemplate> = {};
const ITEM_LOGIC_SETTERS: ((logicBlob: LogicLayer) => void)[] = [];
const ITEM_NAMES: string[] = [];

for (const file of [
	"./bonus-bounty-showcase.ts",
	"./bounty-thumbnail.ts",
	"./colorizers.ts",
	"./goal-initializer.ts",
	"./loot-box.ts",
	"./progress-in-a-can.ts",
	"./unidentified-item.ts",
	"./xp-boosts.ts"
]) {
	const itemTemplateSet: ItemTemplateSet = (await import(`./${file}`)).default;
	ITEM_LOGIC_SETTERS.push(itemTemplateSet.setLogic);
	for (const item of itemTemplateSet.items) {
		ITEMS[item.name] = item;
		ITEM_NAMES.push(item.name);
	}
}

export function getItemNames(exclusions: string[]) {
	return ITEM_NAMES.filter(name => !exclusions.includes(name));
}

export function getItemDescription(itemName: string) {
	return ITEMS[itemName].description;
}

export function getItemCooldown(itemName: string) {
	return ITEMS[itemName].cooldown;
}

/** the truthiness of the awaited return indicates whether to skip decrementing the item count */
export function useItem(itemName: string, interaction: ButtonInteraction<"cached">, theater: InteractionTheater) {
	return ITEMS[itemName].effect(interaction, theater);
}

export function linkAllItemsToLogic(logicBlob: LogicLayer) {
	for (const setter of ITEM_LOGIC_SETTERS) {
		setter(logicBlob);
	}
}

export function addItemsToCooldownDictionary(map: CooldownDictionary) {
	for (const itemKey in ITEMS) {
		map[`item-${itemKey}`] = ITEMS[itemKey].cooldown; //TODONOW port fix for incorrectly constructed key names/paths to main?
	}
}
