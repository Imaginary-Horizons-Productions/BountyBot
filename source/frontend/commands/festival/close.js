const { SubcommandWrapper } = require("../../classes");
const { sendAnnouncement, updateScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed } = require("../../shared");

module.exports = new SubcommandWrapper("close", "End the festival, returning to normal XP",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, company]) {
		company.update({ "festivalMultiplier": 1 });
		interaction.guild.members.fetchMe().then(bountyBot => {
			bountyBot.setNickname(null);
		})
		interaction.reply(sendAnnouncement(company, { content: "The XP multiplier festival has ended. Hope you participate next time!" }));
		const embeds = [];
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
		if (company.scoreboardIsSeasonal) {
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
			embeds.push(await seasonalScoreboardEmbed(company, interaction.guild, await logicLayer.seasons.getParticipationMap(season.id), await logicLayer.ranks.findAllRanks(interaction.guild.id), goalProgress));
		} else {
			embeds.push(await overallScoreboardEmbed(company, interaction.guild, await logicLayer.hunters.findCompanyHunters(interaction.guild.id), goalProgress));
		}
		//TODONOW update evergreen bounty board
		updateScoreboard(company, interaction.guild, embeds);
	}
);
