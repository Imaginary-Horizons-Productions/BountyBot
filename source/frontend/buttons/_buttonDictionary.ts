import { CooldownDictionary, LogicLayer } from "../../shared/types";
import { BuildError, type ButtonFunctionality } from "../classes";

const BUTTON_FUNCTIONALITIES = new Map<string, ButtonFunctionality>();

for (const file of [
	"./secondtoast.js"
]) {
	const button: ButtonFunctionality = (await import(file)).default;
	if (BUTTON_FUNCTIONALITIES.has(button.mainId)) {
		throw new BuildError(`Duplicate button mainId: ${button.mainId}`);
	}
	BUTTON_FUNCTIONALITIES.set(button.mainId, button);
}

export function getButton(mainId: string) {
	const functionality = BUTTON_FUNCTIONALITIES.get(mainId);
	if (!functionality) {
		throw new Error(`Missing ButtonFunctionality: ${mainId}`);
	}
	return functionality;
}

export function linkAllButtonsToLogic(logicBlob: LogicLayer) {
	for (const functionality of BUTTON_FUNCTIONALITIES.values()) {
		functionality.linkToLogic?.(logicBlob);
	}
}

export function addButtonsToCooldownDictionary(cooldownDictionary: CooldownDictionary) {
	for (const [mainId, functionality] of BUTTON_FUNCTIONALITIES) {
		cooldownDictionary[mainId] = functionality.cooldown;
	}
}
