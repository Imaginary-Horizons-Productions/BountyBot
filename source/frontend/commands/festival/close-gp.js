const { Company } = require("../../../database/models");
const { SubcommandWrapper } = require("../../classes");
const { addCompanyAnnouncementPrefix, refreshEvergreenBountiesThread, refreshReferenceChannelScoreboardSeasonal, refreshReferenceChannelScoreboardOverall, updateBotNicknameForFestival } = require("../../shared");

module.exports = new SubcommandWrapper("close-gp", "End the festival, returning to normal GP",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		await theater.company.update({ "gpFestivalMultiplier": 1 });
		updateBotNicknameForFestival(await interaction.guild.members.fetchMe(), theater.company);
		interaction.reply(addCompanyAnnouncementPrefix(theater.company, { content: "The GP multiplier festival has ended. Hope you participate next time!" }));
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(theater.company.id);
		if (theater.company.scoreboardIsSeasonal) {
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(theater.company.id);
			refreshReferenceChannelScoreboardSeasonal(theater.company, interaction.guild, await logicLayer.seasons.getParticipationMap(season.id), await logicLayer.ranks.findAllRanks(theater.company.id), goalProgress);
		} else {
			refreshReferenceChannelScoreboardOverall(theater.company, interaction.guild, await logicLayer.hunters.getCompanyHunterMap(theater.company.id), goalProgress);
		}
		if (theater.company.bountyBoardId) {
			const bountyBoard = await interaction.guild.channels.fetch(theater.company.bountyBoardId);
			const evergreenBounties = await logicLayer.bounties.findEvergreenBounties(theater.company.id);
			const hunterIdMap = {};
			for (const bounty of evergreenBounties) {
				hunterIdMap[bounty.id] = await logicLayer.bounties.getHunterIdSet(bounty.id);
			}
			refreshEvergreenBountiesThread(bountyBoard, evergreenBounties, theater.company, Company.getLevel(theater.company.getXP(await logicLayer.hunters.getCompanyHunterMap(theater.company.id))), interaction.guild.members.me, hunterIdMap);
		}
	}
);
