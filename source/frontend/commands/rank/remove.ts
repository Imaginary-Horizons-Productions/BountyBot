import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, StringSelectMenuBuilder } from "discord.js";
import { SKIP_INTERACTION_HANDLING } from "../../../shared/constants.ts";
import { timeConversion } from "../../../shared/index.ts";
import { SubcommandFunctionality } from "../../classes/index.ts";
import { disabledSelectRow, selectOptionsFromRanks, sentenceListEN, syncRankRoles } from "../../shared/index.ts";

export default new SubcommandFunctionality("remove", "Remove one or more existing seasonal ranks",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		const ranks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const guildRoles = await interaction.guild.roles.fetch();
		const rankNames = {};
		for (let i = 0; i < ranks.length; i++) {
			rankNames[ranks[i].threshold] = ranks[i].getName(guildRoles, i);
		}
		interaction.reply({
			content: "Removing a seasonal rank will delete the Discord role (if one is linked) and recalculate all bounty hunter ranks.",
			components: [
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
					new StringSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
						.setPlaceholder("Select ranks...")
						.setOptions(selectOptionsFromRanks(ranks, guildRoles))
						.setMaxValues(ranks.length)
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message).then(message => {
			const selectCollector = message.createMessageComponentCollector({ time: timeConversion(5, "m", "ms"), componentType: ComponentType.StringSelect })
			const selectedRanks = [];
			const selectedRankNames = [];
			selectCollector.on("collect", selectInteraction => {
				for (const varianceString of selectInteraction.values) {
					selectedRanks.push(ranks.find(rank => {
						const threshold = parseFloat(varianceString);
						return rank.threshold === threshold;
					}))
					selectedRankNames.push(rankNames[parseFloat(varianceString)]);
				}
				selectInteraction.update({
					components: [
						disabledSelectRow(sentenceListEN(selectedRankNames)),
						new ActionRowBuilder<ButtonBuilder>().addComponents(
							new ButtonBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}confirmation`)
								.setStyle(ButtonStyle.Danger)
								.setLabel("Remove")
						)
					]
				})
			})

			const buttonCollector = message.createMessageComponentCollector({ time: timeConversion(5, "m", "ms"), componentType: ComponentType.Button });
			buttonCollector.on("collect", buttonInteraction => {
				for (const rank of selectedRanks) {
					if (rank.roleId) {
						interaction.guild.roles.delete(rank.roleId, 'Removing rank role during rank removal.')
					}
				}
				logicLayer.ranks.deleteRanks(buttonInteraction.guild.id, selectedRanks.map(rank => rank.threshold)).then(async () => {
					const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
					const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
					const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(await logicLayer.seasons.getParticipationMap(season.id), descendingRanks, await interaction.guild.roles.fetch());
					syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);
				});
				buttonInteraction.update({ content: `${selectedRankNames} ${selectedRanks.length > 1 ? "were" : "was"} removed.`, components: [] });
			})
		});
	}
);
