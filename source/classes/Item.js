const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");

class Item {
	/**
	 * @param {string} nameInput
	 * @param {string} descriptionInput
	 * @param {number} cooldownInMS
	 * @param {(interaction: CommandInteraction, database: Sequelize) => Promise<boolean>} effectFunction
	 */
	constructor(nameInput, descriptionInput, cooldownInMS, effectFunction) {
		this.name = nameInput;
		this.description = descriptionInput;
		this.cooldown = cooldownInMS;
		this.effect = effectFunction;
	}
}

module.exports = {
	Item
};
