const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("start", "Start an XP multiplier festival",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, company]) {
		const multiplier = interaction.options.getInteger("multiplier");
		if (multiplier < 2) {
			interaction.reply({ content: `Multiplier must be an integer that is 2 or more.`, flags: [MessageFlags.Ephemeral] })
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
		interaction.reply(company.sendAnnouncement({ content: `An XP multiplier festival has started. Bounty and toast XP will be multiplied by ${multiplier}.` }));
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
).setOptions(
	{
		type: "Integer",
		name: "multiplier",
		description: "The amount to multiply XP by",
		required: true
	}
);
