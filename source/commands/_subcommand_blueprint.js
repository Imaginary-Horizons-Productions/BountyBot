const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer]) {

};

module.exports = {
	data: {
		name: "",
		description: "",
		optionsInput: [
			{
				type: "",
				name: "",
				description: "",
				required: false,
				autocomplete: [{ name: "", value: "" }], // optional
				choices: [{ name: "", value: "" }]  // optional
			}
		]
	},
	executeSubcommand
};
