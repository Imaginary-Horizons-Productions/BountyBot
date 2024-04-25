const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");

class Item {
	/**
	 * @param {string} nameInput
	 * @param {string} descriptionInput
	 * @param {(interaction: CommandInteraction, database: Sequelize) => void} effectFunction
	 */
	constructor(nameInput, descriptionInput, effectFunction) {
		this.name = nameInput;
		this.description = descriptionInput;
		this.effect = effectFunction;
	}
}

module.exports = {
	Item
};
