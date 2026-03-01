const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { addCompanyAnnouncementPrefix, refreshEvergreenBountiesThread, refreshReferenceChannelScoreboardSeasonal, refreshReferenceChannelScoreboardOverall, updateBotNicknameForFestival } = require("../../shared");
const { Company } = require("../../../database/models");

module.exports = new SubcommandWrapper("start-xp", "Start an XP multiplier festival",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const multiplier = interaction.options.getNumber("multiplier");
		if (!(multiplier >= 1)) {
			interaction.reply({ content: `Multiplier must be greater than 1.`, flags: MessageFlags.Ephemeral })
			return;
		}
		origin.company.update({ "xpFestivalMultiplier": multiplier });
		updateBotNicknameForFestival(await interaction.guild.members.fetchMe(), origin.company);
		interaction.reply(addCompanyAnnouncementPrefix(origin.company, { content: `An XP multiplier festival has started. Bounty and toast XP will be multiplied by ${multiplier}.` }));
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
).setOptions(
	{
		type: "Number",
		name: "multiplier",
		description: "The amount to multiply XP by",
		required: true
	}
);
