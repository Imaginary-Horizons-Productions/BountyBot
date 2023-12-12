const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	database.models.Company.update(
		{
			announcementPrefix: "@here",
			maxSimBounties: 5,
			backupTimer: 3600000,
			eventMultiplier: 1,
			xpCoefficient: 3
		},
		{ where: { id: interaction.guildId } }
	);
	interaction.reply({ content: "Server settings have been reset.", ephemeral: true });
};

module.exports = {
	data: {
		name: "server-settings",
		description: "IRREVERSIBLY return all server configs to default",
	},
	executeSubcommand
};
