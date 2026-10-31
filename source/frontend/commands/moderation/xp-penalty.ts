import { MessageFlags, SlashCommandIntegerOption, SlashCommandStringOption, SlashCommandUserOption, userMention } from "discord.js";
import { SubcommandFunctionality } from "../../classes/index.ts";
import { butIgnoreCantDirectMessageThisUserErrors, syncRankRoles } from "../../shared/index.ts";
import { ensureUserFromSlashOptionHasBountyHunter } from "../_earlyOuts.ts";

const bountyHunterOption = new SlashCommandUserOption().setName("bounty-hunter")
	.setDescription("The bounty hunter to remove XP from")
	.setRequired(true);

const penaltyOption = new SlashCommandIntegerOption().setName("penalty")
	.setDescription("The amount of XP to remove")
	.setRequired(true);

const reasonOption = new SlashCommandStringOption().setName("reason")
	.setDescription("The reason for the penalty")
	.setRequired(true);

export default new SubcommandFunctionality("xp-penalty", "Reduce a bounty hunter's XP",
	ensureUserFromSlashOptionHasBountyHunter(bountyHunterOption.name, async function executeSubcommand(interaction, theater, isDevMode, logicLayer, { member, hunter }) {
		const penaltyValue = Math.abs(interaction.options.getInteger(penaltyOption.name, true));
		hunter.decrement({ xp: penaltyValue });
		hunter.increment({ penaltyCount: 1, penaltyPointTotal: penaltyValue });
		const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(theater.company.id);
		await logicLayer.seasons.changeSeasonXP(member.id, theater.company.id, season.id, penaltyValue * -1);
		const descendingRanks = await logicLayer.ranks.findAllRanks(theater.company.id);
		const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(await logicLayer.seasons.getParticipationMap(season.id), descendingRanks, await interaction.guild.roles.fetch());
		syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);
		interaction.reply({ content: `${userMention(member.id)} ${hunter.isBanned ? "(currently banned) " : ""}has been penalized ${penaltyValue} XP.`, flags: MessageFlags.Ephemeral });
		if (!member.user.bot) {
			member.send(`You have been penalized ${penaltyValue} XP by ${interaction.member}. The reason provided was: ${interaction.options.getString(reasonOption.name, true)}`)
				.catch(butIgnoreCantDirectMessageThisUserErrors);
		}
	})
).setOptions(
	bountyHunterOption,
	penaltyOption,
	reasonOption
);
