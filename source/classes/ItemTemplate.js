const { CommandInteraction } = require("discord.js");

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

	/** @param {(logicBlob: typeof import("../logic")) => void} setLogicFunction */
	setLogicLinker(setLogicFunction) {
		this.setLogic = setLogicFunction;
		return this;
	}
}

module.exports = {
	ItemTemplate
};
