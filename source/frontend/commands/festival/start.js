const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { sendAnnouncement, updateScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, updateEvergreenBountyBoard } = require("../../shared");
const { Company } = require("../../../database/models");

module.exports = new SubcommandWrapper("start", "Start an XP multiplier festival",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const multiplier = interaction.options.getNumber("multiplier");
		if (!(multiplier >= 1)) {
			interaction.reply({ content: `Multiplier must be greater than 1.`, flags: MessageFlags.Ephemeral })
			return;
		}
		origin.company.update({ "festivalMultiplier": multiplier });
		interaction.guild.members.fetchMe().then(bountyBot => {
			const multiplierTag = ` [XP x ${multiplier}]`;
			const bountyBotName = bountyBot.nickname ?? bountyBot.displayName;
			if (bountyBotName.length + multiplierTag.length <= 32) {
				bountyBot.setNickname(`${bountyBotName}${multiplierTag}`);
			}
		})
		interaction.reply(sendAnnouncement(origin.company, { content: `An XP multiplier festival has started. Bounty and toast XP will be multiplied by ${multiplier}.` }));
		const embeds = [];
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
		if (origin.company.scoreboardIsSeasonal) {
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
			embeds.push(await seasonalScoreboardEmbed(origin.company, interaction.guild, await logicLayer.seasons.getParticipationMap(season.id), await logicLayer.ranks.findAllRanks(interaction.guild.id), goalProgress));
		} else {
			embeds.push(await overallScoreboardEmbed(origin.company, interaction.guild, await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id), goalProgress));
		}
		updateScoreboard(origin.company, interaction.guild, embeds);
		if (origin.company.bountyBoardId) {
			const bountyBoard = await interaction.guild.channels.fetch(origin.company.bountyBoardId);
			const existingBounties = await logicLayer.bounties.findEvergreenBounties(origin.company.id);
			const hunterIdMap = {};
			for (const bounty of existingBounties) {
				hunterIdMap[bounty.id] = await logicLayer.bounties.getHunterIdSet(bounty.id);
			}
			updateEvergreenBountyBoard(bountyBoard, existingBounties, origin.company, Company.getLevel(origin.company.getXP(await logicLayer.hunters.getCompanyHunterMap(origin.company.id))), interaction.guild, hunterIdMap);
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
