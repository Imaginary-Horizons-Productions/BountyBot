import { EmbedLimits } from "@sapphire/discord.js-utilities";
import { MessageFlags, SlashCommandNumberOption, SlashCommandRoleOption, SlashCommandStringOption, unorderedList } from "discord.js";
import { DatabaseTypes } from "../../../database";
import { SubcommandFunctionality } from "../../classes";
import { commandMention, syncRankRoles } from "../../shared";

const varianceThresholdOption = new SlashCommandNumberOption().setName("variance-threshold")
	.setDescription("The number of standard deviations above mean of season XP earned to qualify")
	.setRequired(true);

const roleOption = new SlashCommandRoleOption().setName("role")
	.setDescription("The role to give hunters that attain this rank");

const rankmojiOption = new SlashCommandStringOption().setName("rankmoji")
	.setDescription("An emoji associated with this rank");

export default new SubcommandFunctionality("add", "Add a seasonal rank for showing outstanding bounty hunters",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		const ranks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const newThreshold = interaction.options.getNumber(varianceThresholdOption.name, true);
		const existingThresholds = ranks.map(rank => rank.threshold);
		if (existingThresholds.includes(newThreshold)) {
			interaction.reply({ content: `There is already a rank at the ${newThreshold} standard deviations threshold for this server. If you'd like to change the role or rankmoji for that rank, you can use ${commandMention("rank edit")}.`, flags: MessageFlags.Ephemeral });
			return;
		}

		if (ranks.length >= EmbedLimits.MaximumFields) {
			interaction.reply({ content: `A server can only have ${EmbedLimits.MaximumFields} seasonal ranks at a time.`, flags: MessageFlags.Ephemeral });
			return;
		}

		const rawRank: Partial<DatabaseTypes.Rank> = {
			companyId: interaction.guildId,
			threshold: newThreshold
		};
		let response = "A new seasonal rank ";
		const errors = [];

		const newRankmoji = interaction.options.getString(rankmojiOption.name);
		if (newRankmoji) {
			rawRank.rankmoji = newRankmoji;
			response += `${newRankmoji} `;
		}

		response += `was created at ${newThreshold} standard deviations above mean season xp`;

		const newRole = interaction.options.getRole(roleOption.name);
		if (newRole) {
			const bountybotGuildMember = await interaction.guild.members.fetchMe();
			if (interaction.guild.roles.comparePositions(bountybotGuildMember.roles.highest, newRole) > 0) {
				rawRank.roleId = newRole.id;
				response += ` with the role ${newRole}`;
			} else {
				errors.push(`Did not assign ${newRole} to the rank. ${bountybotGuildMember} would not be able to add or remove the role from bounty hunters (none of ${bountybotGuildMember}'s roles are above it).`);
			}
		}

		response += ".";
		if (errors.length > 0) {
			response += ` However, the following errors were encountered:\n${unorderedList(errors)}`;
		}

		await logicLayer.ranks.createCustomRank(rawRank);
		const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
		const allRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(await logicLayer.seasons.getParticipationMap(season.id), allRanks, await interaction.guild.roles.fetch());
		syncRankRoles(seasonalHunterReceipts, allRanks, interaction.guild.members);
		interaction.reply({ content: response, flags: MessageFlags.Ephemeral });
	}
).setOptions(
	varianceThresholdOption,
	roleOption,
	rankmojiOption
);
