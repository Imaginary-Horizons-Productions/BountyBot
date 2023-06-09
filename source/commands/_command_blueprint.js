const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');

const customId = "";
const options = [
	{
		type: "",
		name: "",
		description: "",
		required: false,
		choices: [{ name: "", value: "" }]
	}
];
const subcommands = [
	{
		name: "",
		description: "",
		optionsInput: [
			{
				type: "",
				name: "",
				description: "",
				required: false,
				choices: [{ name: "", value: "" }]
			}
		]
	}
];
module.exports = new CommandWrapper(customId, "description", PermissionFlagsBits.ViewChannel, false, true, 3000, options, subcommands,
	/** Command specifications go here */
	(interaction) => {

	}
);
