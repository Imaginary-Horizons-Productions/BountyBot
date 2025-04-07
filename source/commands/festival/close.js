const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("close", "End the festival, returning to normal XP",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, company]) {
		company.update({ "festivalMultiplier": 1 });
		interaction.guild.members.fetchMe().then(bountyBot => {
			bountyBot.setNickname(null);
		})
		interaction.reply(company.sendAnnouncement({ content: "The XP multiplier festival has ended. Hope you participate next time!" }));
		const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
		const embeds = [];
		const ranks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		if (company.scoreboardIsSeasonal) {
			embeds.push(await company.seasonalScoreboardEmbed(interaction.guild, await logicLayer.seasons.findSeasonParticipations(season.id), ranks));
		} else {
			embeds.push(await company.overallScoreboardEmbed(interaction.guild, await logicLayer.hunters.findCompanyHunters(interaction.guild.id), ranks));
		}
		company.updateScoreboard(interaction.guild, embeds);
	}
);
