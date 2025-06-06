const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { sendAnnouncement, updateScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed } = require("../../shared");

module.exports = new SubcommandWrapper("start", "Start an XP multiplier festival",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, company]) {
		const multiplier = interaction.options.getNumber("multiplier");
		if (!(multiplier >= 1)) {
			interaction.reply({ content: `Multiplier must be greater than 1.`, flags: MessageFlags.Ephemeral })
			return;
		}
		company.update({ "festivalMultiplier": multiplier });
		interaction.guild.members.fetchMe().then(bountyBot => {
			const multiplierTag = ` [XP x ${multiplier}]`;
			const bountyBotName = bountyBot.nickname ?? bountyBot.displayName;
			if (bountyBotName.length + multiplierTag.length <= 32) {
				bountyBot.setNickname(`${bountyBotName}${multiplierTag}`);
			}
		})
		interaction.reply(sendAnnouncement(company, { content: `An XP multiplier festival has started. Bounty and toast XP will be multiplied by ${multiplier}.` }));
		const embeds = [];
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
		if (company.scoreboardIsSeasonal) {
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
			embeds.push(await seasonalScoreboardEmbed(company, interaction.guild, await logicLayer.seasons.getParticipationMap(season.id), await logicLayer.ranks.findAllRanks(interaction.guild.id), goalProgress));
		} else {
			embeds.push(await overallScoreboardEmbed(company, interaction.guild, await logicLayer.hunters.findCompanyHunters(interaction.guild.id), goalProgress));
		}
		updateScoreboard(company, interaction.guild, embeds);
	}
).setOptions(
	{
		type: "Number",
		name: "multiplier",
		description: "The amount to multiply XP by",
		required: true
	}
);
