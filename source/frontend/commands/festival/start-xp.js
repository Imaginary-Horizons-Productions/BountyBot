const { SubcommandWrapper } = require("../../classes");
const { addCompanyAnnouncementPrefix, refreshEvergreenBountiesThread, refreshReferenceChannelScoreboardSeasonal, refreshReferenceChannelScoreboardOverall, updateBotNicknameForFestival } = require("../../shared");
const { ensureNumberFromSlashOptionIsGreaterThanOne } = require("../_earlyOuts");
const { DatabaseTypes } = require("../../../database");

module.exports = new SubcommandWrapper("start-xp", "Start an XP multiplier festival",
	ensureNumberFromSlashOptionIsGreaterThanOne("multiplier", async function executeSubcommand(interaction, theater, isDevMode, logicLayer, multiplier) {
		theater.company.update({ "xpFestivalMultiplier": multiplier });
		updateBotNicknameForFestival(await interaction.guild.members.fetchMe(), theater.company);
		interaction.reply(addCompanyAnnouncementPrefix(theater.company, { content: `An XP multiplier festival has started. Bounty and toast XP will be multiplied by ${multiplier}.` }));
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(theater.company.id);
		if (theater.company.scoreboardIsSeasonal) {
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(theater.company.id);
			refreshReferenceChannelScoreboardSeasonal(theater.company, interaction.guild, await logicLayer.seasons.getParticipationMap(season.id), await logicLayer.ranks.findAllRanks(theater.company.id), goalProgress);
		} else {
			refreshReferenceChannelScoreboardOverall(theater.company, interaction.guild, await logicLayer.hunters.getCompanyHunterMap(theater.company.id), goalProgress);
		}
		if (theater.company.bountyBoardId) {
			const bountyBoard = await interaction.guild.channels.fetch(theater.company.bountyBoardId);
			const existingBounties = await logicLayer.bounties.findEvergreenBounties(theater.company.id);
			const hunterIdMap = {};
			for (const bounty of existingBounties) {
				hunterIdMap[bounty.id] = await logicLayer.bounties.getHunterIdSet(bounty.id);
			}
			refreshEvergreenBountiesThread(bountyBoard, existingBounties, theater.company, DatabaseTypes.Company.getLevel(theater.company.getXP(await logicLayer.hunters.getCompanyHunterMap(theater.company.id))), interaction.guild.members.me, hunterIdMap);
		}
	})
).setOptions(
	{
		type: "Number",
		name: "multiplier",
		description: "The amount to multiply XP by",
		required: true
	}
);
