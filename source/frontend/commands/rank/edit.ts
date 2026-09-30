import { MessageFlags, SlashCommandNumberOption, SlashCommandRoleOption, SlashCommandStringOption, unorderedList } from "discord.js";
import { DatabaseTypes } from "../../../database/index.ts";
import { SubcommandFunctionality } from "../../classes/index.ts";
import { syncRankRoles } from "../../shared/index.ts";

const varianceThresholdOption = new SlashCommandNumberOption().setName("variance-threshold")
	.setDescription("The variance threshold of the rank to edit")
	.setRequired(true);

const roleOption = new SlashCommandRoleOption().setName("role")
	.setDescription("The role to give hunters that attain this rank");

const rankmojiOption = new SlashCommandStringOption().setName("rankmoji")
	.setDescription("An emoji associated with this rank");

export default new SubcommandFunctionality("edit", "Change the role or rankmoji for a seasonal rank",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		const threshold = interaction.options.getNumber(varianceThresholdOption.name, true);
		const rank = await logicLayer.ranks.findOneRank(interaction.guild.id, threshold);
		if (!rank) {
			interaction.reply({ content: `Could not find a seasonal rank with variance threshold of ${threshold}.`, flags: MessageFlags.Ephemeral });
			return;
		}

		const updateOptions: Partial<DatabaseTypes.Rank> = {};
		let response = "The seasonal rank ";
		const errors = [];

		const newRankmoji = interaction.options.getString(rankmojiOption.name);
		if (newRankmoji) {
			updateOptions.rankmoji = newRankmoji;
			response += `${newRankmoji} `;
		}

		response += `at ${threshold} standard deviations above mean season xp was updated`;

		const newRole = interaction.options.getRole(roleOption.name);
		if (newRole) {
			const bountybotGuildMember = await interaction.guild.members.fetchMe();
			if (interaction.guild.roles.comparePositions(bountybotGuildMember.roles.highest, newRole) > 0) {
				updateOptions.roleId = newRole.id;
				response += ` to give the role ${newRole}`;
			} else {
				errors.push(`Did not assign ${newRole} to the rank. ${bountybotGuildMember} would not be able to add or remove the role from bounty hunters (none of ${bountybotGuildMember}'s roles are above it).`);
			}
		}

		response += ".";
		if (errors.length > 0) {
			response += ` However, the following errors were encountered:\n${unorderedList(errors)}`;
		}

		rank.update(updateOptions);
		const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
		const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(await logicLayer.seasons.getParticipationMap(season.id), descendingRanks, await interaction.guild.roles.fetch());
		syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);
		interaction.reply({ content: response, flags: MessageFlags.Ephemeral });
	}
).setOptions(
	varianceThresholdOption,
	roleOption,
	rankmojiOption
);
