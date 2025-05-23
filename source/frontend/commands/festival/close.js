const { SubcommandWrapper } = require("../../classes");
const { sendAnnouncement, updateScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed } = require("../../shared");

module.exports = new SubcommandWrapper("close", "End the festival, returning to normal XP",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, company]) {
		company.update({ "festivalMultiplier": 1 });
		interaction.guild.members.fetchMe().then(bountyBot => {
			bountyBot.setNickname(null);
		})
		interaction.reply(sendAnnouncement(company, { content: "The XP multiplier festival has ended. Hope you participate next time!" }));
		const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
		const embeds = [];
		const ranks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
		if (company.scoreboardIsSeasonal) {
			embeds.push(await seasonalScoreboardEmbed(company, interaction.guild, await logicLayer.seasons.findSeasonParticipations(season.id), ranks, goalProgress));
		} else {
			embeds.push(await overallScoreboardEmbed(company, interaction.guild, await logicLayer.hunters.findCompanyHunters(interaction.guild.id), ranks, goalProgress));
		}
		updateScoreboard(company, interaction.guild, embeds);
	}
);
