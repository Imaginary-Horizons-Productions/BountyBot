const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");

/** @type {typeof import("../../logic")} */
let logicLayer;

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
				autocomplete: [{ name: "", value: "" }], // optional
				choices: [{ name: "", value: "" }]  // optional
			}
		]
	},
	executeSubcommand,
	setLogic: (logicBlob) => {
		logicLayer = logicBlob;
	}
};
