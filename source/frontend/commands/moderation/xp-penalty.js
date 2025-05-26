const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { syncRankRoles } = require("../../shared");

module.exports = new SubcommandWrapper("xp-penalty", "Reduce a bounty hunter's XP",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		const member = interaction.options.getMember("bounty-hunter");
		const hunter = await logicLayer.hunters.findOneHunter(member.id, interaction.guild.id);
		if (!hunter) {
			interaction.reply({ content: `${member} hasn't interacted with BountyBot yet.`, flags: MessageFlags.Ephemeral });
			return;
		}
		const penaltyValue = Math.abs(interaction.options.getInteger("penalty"));
		hunter.decrement({ xp: penaltyValue });
		hunter.increment({ penaltyCount: 1, penaltyPointTotal: penaltyValue });
		const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
		await logicLayer.seasons.changeSeasonXP(member.id, interaction.guildId, season.id, penaltyValue * -1);
		const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const seasonUpdates = await logicLayer.seasons.updatePlacementsAndRanks(await logicLayer.seasons.getParticipationMap(season.id), descendingRanks);
		syncRankRoles(seasonUpdates, descendingRanks, interaction.guild.members);
		interaction.reply({ content: `<@${member.id}> has been penalized ${penaltyValue} XP.`, flags: MessageFlags.Ephemeral });
		if (!member.user.bot) {
			member.send(`You have been penalized ${penaltyValue} XP by ${interaction.member}. The reason provided was: ${interaction.options.getString("reason")}`);
		}
	}
).setOptions(
	{
		type: "User",
		name: "bounty-hunter",
		description: "The bounty hunter to remove XP from",
		required: true
	},
	{
		type: "Integer",
		name: "penalty",
		description: "The amount of XP to remove",
		required: true
	},
	{
		type: "String",
		name: "reason",
		description: "The reason for the penalty",
		required: true
	}
);
