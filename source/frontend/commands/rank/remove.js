const { MessageFlags, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, ButtonBuilder, ButtonStyle } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { selectOptionsFromRanks, sentenceListEN, disabledSelectRow, syncRankRoles } = require("../../shared");
const { timeConversion } = require("../../../shared");

module.exports = new SubcommandWrapper("remove", "Remove one or more existing seasonal ranks",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const ranks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const guildRoles = await interaction.guild.roles.fetch();
		const rankNames = {};
		for (let i = 0; i < ranks.length; i++) {
			rankNames[ranks[i].threshold] = ranks[i].getName(guildRoles, i);
		}
		interaction.reply({
			content: "Removing a seasonal rank will delete the Discord role (if one is linked) and recalculate all bounty hunter ranks.",
			components: [
				new ActionRowBuilder().addComponents(
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
						new ActionRowBuilder().addComponents(
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
