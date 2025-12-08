const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { syncRankRoles, butIgnoreCantSendToThisUserErrors } = require("../../shared");

module.exports = new SubcommandWrapper("season-disqualify", "Toggle disqualification from ranking for a bounty hunter in the current season",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const member = interaction.options.getMember("bounty-hunter");
		await logicLayer.companies.findOrCreateCompany(interaction.guild.id);
		const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
		const participation = await logicLayer.seasons.toggleHunterSeasonDisqualification(member.id, interaction.guildId, season.id);
		const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const seasonUpdates = await logicLayer.seasons.updatePlacementsAndRanks(await logicLayer.seasons.getParticipationMap(season.id), descendingRanks);
		syncRankRoles(seasonUpdates, descendingRanks, interaction.guild.members);
		interaction.reply({ content: `<@${member.id}> has been ${participation.isRankDisqualified ? "dis" : "re"}qualified for achieving ranks this season.`, flags: MessageFlags.Ephemeral });
		if (!member.user.bot) {
			member.send(`You have been ${participation.isRankDisqualified ? "dis" : "re"}qualified for season ranks this season by ${interaction.member}. The reason provided was: ${interaction.options.getString("reason")}`)
				.catch(butIgnoreCantSendToThisUserErrors);
		}
	}
).setOptions(
	{
		type: "User",
		name: "bounty-hunter",
		description: "The mention of the hunter to disqualify/requalify",
		required: true
	},
	{
		type: "String",
		name: "reason",
		description: "The reason for the disqualification",
		required: true
	}
);
