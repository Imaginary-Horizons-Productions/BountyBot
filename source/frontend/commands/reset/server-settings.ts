import { MessageFlags } from "discord.js";
import { SubcommandFunctionality } from "../../classes/index.ts";

export default new SubcommandFunctionality("server-settings", "IRREVERSIBLY return all server configs to default",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		logicLayer.companies.resetCompanySettings(interaction.guild.id);
		interaction.reply({ content: "Server settings have been reset.", flags: MessageFlags.Ephemeral });
	}
);
