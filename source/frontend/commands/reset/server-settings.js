const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("server-settings", "IRREVERSIBLY return all server configs to default",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		logicLayer.companies.resetCompanySettings(interaction.guild.id);
		interaction.reply({ content: "Server settings have been reset.", flags: MessageFlags.Ephemeral });
	}
);
