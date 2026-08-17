import { StringSelectMenuInteraction } from "discord.js";
import type { LogicLayer } from "../../logic";
import { InteractionTheater } from "./InteractionTheater";

export class ItemTemplateSet {
	declare items: ItemTemplate[];
	declare setLogic: (logicBlob: LogicLayer) => void;

	constructor(...itemTemplates: ItemTemplate[]) {
		this.items = itemTemplates;
	}

	setLogicLinker(setLogicFunction: (logicBlob: LogicLayer) => void) {
		this.setLogic = setLogicFunction;
		return this;
	}
}

type ItemProcedure = (interaction: StringSelectMenuInteraction<"cached">, theater: InteractionTheater) => Promise<number>;

export class ItemTemplate {
	declare name: string;
	declare description: string;
	declare cooldown: number;
	declare effect: ItemProcedure;

	constructor(nameArgument: string, descriptionArgument: string, cooldownInMS: number, procedure: ItemProcedure) {
		this.name = nameArgument;
		this.description = descriptionArgument;
		this.cooldown = cooldownInMS;
		this.effect = procedure;
	}
}
