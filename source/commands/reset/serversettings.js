const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer]) {
	logicLayer.companies.resetCompanySettings(interaction.guild.id);
	interaction.reply({ content: "Server settings have been reset.", flags: [MessageFlags.Ephemeral] });
};

module.exports = {
	data: {
		name: "server-settings",
		description: "IRREVERSIBLY return all server configs to default",
	},
	executeSubcommand
};
