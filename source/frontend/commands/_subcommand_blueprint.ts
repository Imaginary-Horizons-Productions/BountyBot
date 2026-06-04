import { SubcommandFunctionality } from "../../classes";

export default new SubcommandFunctionality("", "",
	async function executeSubcommand(interaction, origin, isDevMode, logicLayer) {

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
