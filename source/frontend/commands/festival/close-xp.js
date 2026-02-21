const { Company } = require("../../../database/models");
const { SubcommandWrapper } = require("../../classes");
const { addCompanyAnnouncementPrefix, refreshEvergreenBountiesThread, refreshReferenceChannelScoreboardSeasonal, refreshReferenceChannelScoreboardOverall, updateBotNicknameForFestival } = require("../../shared");

module.exports = new SubcommandWrapper("close-xp", "End the festival, returning to normal XP",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		origin.company.update({ "xpFestivalMultiplier": 1 });
		updateBotNicknameForFestival(await interaction.guild.members.fetchMe(), origin.company);
		interaction.reply(addCompanyAnnouncementPrefix(origin.company, { content: "The XP multiplier festival has ended. Hope you participate next time!" }));
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(origin.company.id);
		if (origin.company.scoreboardIsSeasonal) {
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(origin.company.id);
			refreshReferenceChannelScoreboardSeasonal(origin.company, interaction.guild, await logicLayer.seasons.getParticipationMap(season.id), await logicLayer.ranks.findAllRanks(origin.company.id), goalProgress);
		} else {
			refreshReferenceChannelScoreboardOverall(origin.company, interaction.guild, await logicLayer.hunters.getCompanyHunterMap(origin.company.id), goalProgress);
		}
		if (origin.company.bountyBoardId) {
			const bountyBoard = await interaction.guild.channels.fetch(origin.company.bountyBoardId);
			const existingBounties = await logicLayer.bounties.findEvergreenBounties(origin.company.id);
			const hunterIdMap = {};
			for (const bounty of existingBounties) {
				hunterIdMap[bounty.id] = await logicLayer.bounties.getHunterIdSet(bounty.id);
			}
			refreshEvergreenBountiesThread(bountyBoard, existingBounties, origin.company, Company.getLevel(origin.company.getXP(await logicLayer.hunters.getCompanyHunterMap(origin.company.id))), interaction.guild, hunterIdMap);
		}
	}
);
