const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { butIgnoreCantDirectMessageThisUserErrors, refreshReferenceChannelScoreboardSeasonal, refreshReferenceChannelScoreboardOverall } = require("../../shared");

module.exports = new SubcommandWrapper("all-hunter-stats", "IRREVERSIBLY reset all bounty hunter stats on this server",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		logicLayer.hunters.deleteCompanyHunters(interaction.guild.id);
		interaction.reply({ content: "Resetting bounty hunter stats has begun.", flags: MessageFlags.Ephemeral });
		const season = await logicLayer.seasons.findOneSeason(interaction.guild.id, "current");
		if (season) {
			await logicLayer.seasons.deleteSeasonParticipations(season.id);
		}
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
		if (origin.company.scoreboardIsSeasonal) {
			refreshReferenceChannelScoreboardSeasonal(origin.company, interaction.guild, new Map(), await logicLayer.ranks.findAllRanks(interaction.guild.id), goalProgress);
		} else {
			refreshReferenceChannelScoreboardOverall(origin.company, interaction.guild, new Map(), goalProgress);
		}
		interaction.user.send(`Resetting bounty hunter stats on ${interaction.guild.name} has completed.`)
			.catch(butIgnoreCantDirectMessageThisUserErrors);
	}
);
