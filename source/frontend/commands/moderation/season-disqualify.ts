import { MessageFlags, SlashCommandStringOption, SlashCommandUserOption } from "discord.js";
import { SubcommandFunctionality } from "../../classes/index.ts";
import { butIgnoreCantDirectMessageThisUserErrors, syncRankRoles } from "../../shared/index.ts";

const bountyHunterOption = new SlashCommandUserOption().setName("bounty-hunter")
	.setDescription("The mention of the hunter to disqualify/requalify")
	.setRequired(true);

const reasonOption = new SlashCommandStringOption().setName("reason")
	.setDescription("The reason for the disqualification")
	.setRequired(true);

export default new SubcommandFunctionality("season-disqualify", "Toggle disqualification from ranking for a bounty hunter in the current season",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		const bountyHunterUser = interaction.options.getUser(bountyHunterOption.name, true);
		await logicLayer.companies.findOrCreateCompany(interaction.guild.id);
		const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
		const participation = await logicLayer.seasons.toggleHunterSeasonDisqualification(bountyHunterUser.id, interaction.guildId, season.id);
		const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(await logicLayer.seasons.getParticipationMap(season.id), descendingRanks, await interaction.guild.roles.fetch());
		syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);
		interaction.reply({ content: `${bountyHunterUser.toString()} has been ${participation.isRankDisqualified ? "dis" : "re"}qualified for achieving ranks this season.`, flags: MessageFlags.Ephemeral });
		if (!bountyHunterUser.bot) {
			bountyHunterUser.send(`You have been ${participation.isRankDisqualified ? "dis" : "re"}qualified for season ranks this season by ${interaction.member}. The reason provided was: ${interaction.options.getString(reasonOption.name, true)}`)
				.catch(butIgnoreCantDirectMessageThisUserErrors);
		}
	}
).setOptions(
	bountyHunterOption,
	reasonOption
);
