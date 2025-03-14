const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("all-hunter-stats", "IRREVERSIBLY reset all bounty hunter stats on this server",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		logicLayer.hunters.deleteCompanyHunters(interaction.guild.id);
		interaction.reply({ content: "Resetting bounty hunter stats has begun.", flags: [MessageFlags.Ephemeral] });
		const company = await logicLayer.companies.findCompanyByPK(interaction.guild.id);
		const season = await logicLayer.seasons.findOneSeason(interaction.guild.id, "current");
		if (season) {
			await logicLayer.seasons.deleteSeasonParticipations(season.id);
		}
		company.updateScoreboard(interaction.guild, logicLayer);
		interaction.user.send(`Resetting bounty hunter stats on ${interaction.guild.name} has completed.`);
	}
);
