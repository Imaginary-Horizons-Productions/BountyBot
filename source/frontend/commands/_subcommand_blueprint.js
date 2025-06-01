const { SubcommandWrapper } = require("../classes");

module.exports = new SubcommandWrapper("", "",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {

	}
).setOptions(
	{
		type: "",
		name: "",
		description: "",
		required: false,
		autocomplete: [{ name: "", value: "" }], // optional
		choices: [{ name: "", value: "" }]  // optional
	}
);
