const { CommandInteraction } = require("discord.js");

class ItemTemplateSet {
	/** @param {ItemTemplate[]} itemTemplates */
	constructor(...itemTemplates) {
		this.items = itemTemplates;
	}

	/** @param {(logicBlob: typeof import("../logic")) => void} setLogicFunction */
	setLogicLinker(setLogicFunction) {
		this.setLogic = setLogicFunction;
		return this;
	}
}

class ItemTemplate {
	/**
	 * @param {string} nameInput
	 * @param {string} descriptionInput
	 * @param {number} cooldownInMS
	 * @param {(interaction: CommandInteraction) => Promise<boolean>} effectFunction
	 */
	constructor(nameInput, descriptionInput, cooldownInMS, effectFunction) {
		this.name = nameInput;
		this.description = descriptionInput;
		this.cooldown = cooldownInMS;
		this.effect = effectFunction;
	}
}

module.exports = {
	ItemTemplateSet,
	ItemTemplate
};
