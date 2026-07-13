import { ChatInputCommandInteraction } from "discord.js";
import { LogicLayer } from "../../logic";
import { InteractionTheater } from "./InteractionTheater";

export class ItemTemplateSet {
	constructor(...itemTemplates: ItemTemplate[]) {
		this.items = itemTemplates;
	}

	setLogicLinker(setLogicFunction: (logicBlob: LogicLayer) => void) {
		this.setLogic = setLogicFunction;
		return this;
	}
}

export class ItemTemplate {
	constructor(nameArgument: string, descriptionArgument: string, cooldownInMS: number, procedure: (interaction: ChatInputCommandInteraction, theater: InteractionTheater) => Promise<boolean>) {
		this.name = nameArgument;
		this.description = descriptionArgument;
		this.cooldown = cooldownInMS;
		this.effect = procedure;
	}
}
