const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");
const { updateScoreboard } = require("../../util/embedUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer]) {
	database.models.Hunter.destroy({ where: { companyId: interaction.guildId } });
	interaction.reply({ content: "Resetting bounty hunter stats has begun.", flags: [MessageFlags.Ephemeral] });
	await logicLayer.companies.findCompanyByPK(interaction.guild.id);
	const season = await logicLayer.seasons.findOneSeason(interaction.guild.id, "current");
	if (season) {
		await database.models.Participation.destroy({ where: { seasonId: season.id } });
	}
	updateScoreboard(interaction.guild, database, logicLayer);
	interaction.user.send(`Resetting bounty hunter stats on ${interaction.guild.name} has completed.`);
};

module.exports = {
	data: {
		name: "all-hunter-stats",
		description: "IRREVERSIBLY reset all bounty hunter stats on this server",
	},
	executeSubcommand
};
