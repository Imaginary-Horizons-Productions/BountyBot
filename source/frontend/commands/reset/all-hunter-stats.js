const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { refreshReferenceChannelScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, butIgnoreCantDirectMessageThisUserErrors } = require("../../shared");

module.exports = new SubcommandWrapper("all-hunter-stats", "IRREVERSIBLY reset all bounty hunter stats on this server",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		logicLayer.hunters.deleteCompanyHunters(interaction.guild.id);
		interaction.reply({ content: "Resetting bounty hunter stats has begun.", flags: MessageFlags.Ephemeral });
		const season = await logicLayer.seasons.findOneSeason(interaction.guild.id, "current");
		if (season) {
			await logicLayer.seasons.deleteSeasonParticipations(season.id);
		}
		const embeds = [];
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
		if (origin.company.scoreboardIsSeasonal) {
			embeds.push(await seasonalScoreboardEmbed(origin.company, interaction.guild, new Map(), await logicLayer.ranks.findAllRanks(interaction.guild.id), goalProgress));
		} else {
			embeds.push(await overallScoreboardEmbed(origin.company, interaction.guild, new Map(), goalProgress));
		}
		refreshReferenceChannelScoreboard(origin.company, interaction.guild, embeds);
		interaction.user.send(`Resetting bounty hunter stats on ${interaction.guild.name} has completed.`)
			.catch(butIgnoreCantDirectMessageThisUserErrors);
	}
);
