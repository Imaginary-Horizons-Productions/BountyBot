const { MessageFlags, userMention } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { syncRankRoles, butIgnoreCantDirectMessageThisUserErrors } = require("../../shared");
const { ensureUserFromSlashOptionHasBountyHunter } = require("../_earlyOuts");

module.exports = new SubcommandWrapper("xp-penalty", "Reduce a bounty hunter's XP",
	ensureUserFromSlashOptionHasBountyHunter("bounty-hunter", async function executeSubcommand(interaction, theater, isDevMode, logicLayer, { member, hunter }) {
		const penaltyValue = Math.abs(interaction.options.getInteger("penalty"));
		hunter.decrement({ xp: penaltyValue });
		hunter.increment({ penaltyCount: 1, penaltyPointTotal: penaltyValue });
		const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(theater.company.id);
		await logicLayer.seasons.changeSeasonXP(member.id, theater.company.id, season.id, penaltyValue * -1);
		const descendingRanks = await logicLayer.ranks.findAllRanks(theater.company.id);
		const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(await logicLayer.seasons.getParticipationMap(season.id), descendingRanks, await interaction.guild.roles.fetch());
		syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);
		interaction.reply({ content: `${userMention(member.id)} ${hunter.isBanned ? "(currently banned) " : ""}has been penalized ${penaltyValue} XP.`, flags: MessageFlags.Ephemeral });
		if (!member.user.bot) {
			member.send(`You have been penalized ${penaltyValue} XP by ${interaction.member}. The reason provided was: ${interaction.options.getString("reason")}`)
				.catch(butIgnoreCantDirectMessageThisUserErrors);
		}
	})
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
