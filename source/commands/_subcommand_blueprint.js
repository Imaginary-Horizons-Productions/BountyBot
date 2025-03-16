const { CommandInteraction } = require("discord.js");

/**
 * @param {CommandInteraction} interaction
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, runMode, ...[logicLayer]) {

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
