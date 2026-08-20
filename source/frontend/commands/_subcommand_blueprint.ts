import { SlashCommandStringOption } from "discord.js";
import { SubcommandFunctionality } from "../../classes";

const subcommandOption = new SlashCommandStringOption();

export default new SubcommandFunctionality("", "",
	async function subcommandProcedure(interaction, origin, isDevMode, logicLayer) {

	}
).setOptions(
	subcommandOption
);
