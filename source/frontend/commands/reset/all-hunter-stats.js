const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { updateScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed } = require("../../shared");

module.exports = new SubcommandWrapper("all-hunter-stats", "IRREVERSIBLY reset all bounty hunter stats on this server",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		logicLayer.hunters.deleteCompanyHunters(interaction.guild.id);
		interaction.reply({ content: "Resetting bounty hunter stats has begun.", flags: MessageFlags.Ephemeral });
		const company = await logicLayer.companies.findCompanyByPK(interaction.guild.id);
		const season = await logicLayer.seasons.findOneSeason(interaction.guild.id, "current");
		if (season) {
			await logicLayer.seasons.deleteSeasonParticipations(season.id);
		}
		const embeds = [];
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
		if (company.scoreboardIsSeasonal) {
			embeds.push(await seasonalScoreboardEmbed(company, interaction.guild, new Map(), await logicLayer.ranks.findAllRanks(interaction.guild.id), goalProgress));
		} else {
			embeds.push(await overallScoreboardEmbed(company, interaction.guild, [], goalProgress));
		}
		updateScoreboard(company, interaction.guild, embeds);
		interaction.user.send(`Resetting bounty hunter stats on ${interaction.guild.name} has completed.`);
	}
);
