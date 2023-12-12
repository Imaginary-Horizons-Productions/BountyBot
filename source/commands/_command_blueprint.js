const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');

const mainId = "";
const options = [
	{
		type: "",
		name: "",
		description: "",
		required: false,
		autocomplete: [{ name: "", value: "" }], // optional
		choices: [{ name: "", value: "" }] // optional
	}
];
const subcommandSlashData = [];
const subcommandExecuteDictionary = {};
for (const fileName of [
]) {
	const subcommand = require(fileName);
	subcommandSlashData.push(subcommand.data);
	subcommandExecuteDictionary[subcommand.data.name] = subcommand.executeSubcommand;
};
module.exports = new CommandWrapper(mainId, "description", PermissionFlagsBits.ViewChannel, false, true, 3000,
	/** Command specifications go here */
	(interaction, database, runMode) => {

	}
).setOptions(options).setSubcommands(subcommandSlashData);
