import { BaseApplicationCommandData } from "discord.js";
import { BuildError, type SelectOptionFunctionality, type SelectOptionProcedure, type SubcommandFunctionality, type SubcommandProcedure } from "../classes";

export async function aggregateSubcommands(mainId: string, fileList: string[]) { //TODONOW mappings.slashData of wrong type?
	const mappings: { slashData: BaseApplicationCommandData[], executeDictionary: Record<string, SubcommandProcedure> } = {
		slashData: [],
		executeDictionary: {}
	};
	for (const fileName of fileList) {
		const subcommand = (await import(`../commands/${mainId}/${fileName}`)).default as SubcommandFunctionality;
		mappings.slashData.push(subcommand.data);
		mappings.executeDictionary[subcommand.data.name] = subcommand.procedure;
	};
	return mappings;
};

export async function aggregateSelectOptionMap(mainId: string, fileList: string[]) {
	const selectOptionMap: Record<string, SelectOptionProcedure> = {};
	for (const fileName of fileList) {
		const option = (await import(`../selects/${mainId}/${fileName}`)).default as SelectOptionFunctionality;
		if (option.name in selectOptionMap) {
			throw new BuildError(`duplicate select option name: ${option.name}`);
		}
		selectOptionMap[option.name] = option.execute;
	};
	return selectOptionMap;
}
