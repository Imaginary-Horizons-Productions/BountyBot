import { AnySelectMenuInteraction, BaseApplicationCommandData, CommandInteraction } from "discord.js";
import { LogicLayer } from "../../logic";
import { BuildError, InteractionTheater, SelectOptionFunctionality, SubcommandFunctionality } from "../classes";

export async function aggregateSubcommands(mainId: string, fileList: string[]) { //TODONOW became async
	const mappings: { slashData: BaseApplicationCommandData[], executeDictionary: Record<string, (interaction: CommandInteraction, isDevMode: boolean, ...args: [LogicLayer, unknown]) => Promise<void>> } = {
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

export async function aggregateSelectOptionMap(mainId: string, fileList: string[]) { //TODONOW became async
	const selectOptionMap: Record<string, (interaction: AnySelectMenuInteraction, origin: InteractionTheater, isDevMode: boolean, logicLayer: LogicLayer, ...args: string[]) => Promise<void>> = {};
	for (const fileName of fileList) {
		const option = (await import(`../selects/${mainId}/${fileName}`)).default as SelectOptionFunctionality;
		if (option.name in selectOptionMap) {
			throw new BuildError(`duplicate select option name: ${option.name}`);
		}
		selectOptionMap[option.name] = option.execute;
	};
	return selectOptionMap;
}
