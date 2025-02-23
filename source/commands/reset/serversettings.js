const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer]) {
	database.models.Company.update(
		{
			announcementPrefix: "@here",
			maxSimBounties: 5,
			backupTimer: 3600000,
			festivalMultiplier: 1,
			xpCoefficient: 3,
			toastThumbnailURL: null,
			openBountyThumbnailURL: null,
			completedBountyThumbnailURL: null,
			scoreboardThumbnailURL: null,
			serverBonusesThumbnailURL: null
		},
		{ where: { id: interaction.guildId } }
	);
	interaction.reply({ content: "Server settings have been reset.", flags: [MessageFlags.Ephemeral] });
};

module.exports = {
	data: {
		name: "server-settings",
		description: "IRREVERSIBLY return all server configs to default",
	},
	executeSubcommand
};
