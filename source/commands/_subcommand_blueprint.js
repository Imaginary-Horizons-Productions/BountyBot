const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {

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
				autocompleteFilter: (interaction, database) => { return [{ name: "", value: "" }] }, // optional
				choices: [{ name: "", value: "" }]  // optional
			}
		]
	},
	executeSubcommand
};
