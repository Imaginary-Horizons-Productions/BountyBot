import { LogicLayer } from "../../logic";
import { CooldownDictionary } from "../../shared/types";
import { BuildError, SelectFunctionality } from "../classes";

const SELECT_FUNCTIONALITIES = new Map<string, SelectFunctionality>();

for (const file of [
	"./bountycontrolpanel.ts"
]) {
	const select: SelectFunctionality = (await import(file)).default;
	if (SELECT_FUNCTIONALITIES.has(select.mainId)) {
		throw new BuildError(`Duplicate select mainId: ${select.mainId}`);
	}
	SELECT_FUNCTIONALITIES.set(select.mainId, select);
}

export function getSelect(mainId: string) {
	const functionality = SELECT_FUNCTIONALITIES.get(mainId);
	if (!functionality) {
		throw new Error(`Missing SelectFunctionality: ${mainId}`);
	}
	return functionality;
}

export function linkAllSelectsToLogic(logicBlob: LogicLayer) {
	for (const functionality of SELECT_FUNCTIONALITIES.values()) {
		functionality.linkToLogic?.(logicBlob);
	}
}

export function addSelectsToCooldownDictionary(cooldownDictionary: CooldownDictionary) {
	for (const [mainId, functionality] of SELECT_FUNCTIONALITIES) {
		cooldownDictionary[mainId] = functionality.cooldown;
	}
}
