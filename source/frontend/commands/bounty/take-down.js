const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { commandMention, selectOptionsFromBounties, syncRankRoles, butIgnoreInteractionCollectorErrors } = require("../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");

module.exports = new SubcommandWrapper("take-down", "Take down one of your bounties without awarding XP (forfeit posting XP)",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guild.id).then(openBounties => {
			interaction.reply({
				content: `If you'd like to change the title, description, image, or time of your bounty, you can use ${commandMention("bounty edit")} instead.`,
				components: [
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
							.setPlaceholder("Select a bounty to take down...")
							.setMaxValues(1)
							.setOptions(selectOptionsFromBounties(openBounties))
					)
				],
				flags: MessageFlags.Ephemeral,
				withResponse: true
			}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
				const [bountyId] = collectedInteraction.values;
				const bounty = await logicLayer.bounties.findBounty(bountyId);
				bounty.state = "deleted";
				bounty.save();
				logicLayer.bounties.deleteBountyCompletions(bountyId);
				if (origin.company.bountyBoardId) {
					const bountyBoard = await interaction.guild.channels.fetch(origin.company.bountyBoardId);
					const postingThread = await bountyBoard.threads.fetch(bounty.postingId);
					if (postingThread) {
						postingThread.delete("Bounty taken down by poster");
					}
				}
				bounty.destroy();

				origin.hunter.decrement("xp");
				const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
				await logicLayer.seasons.changeSeasonXP(interaction.user.id, interaction.guildId, season.id, -1);
				const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
				const seasonUpdates = await logicLayer.seasons.updatePlacementsAndRanks(await logicLayer.seasons.getParticipationMap(season.id), descendingRanks);
				syncRankRoles(seasonUpdates, descendingRanks, interaction.guild.members);

				collectedInteraction.reply({ content: "Your bounty has been taken down.", flags: MessageFlags.Ephemeral });
			}).catch(butIgnoreInteractionCollectorErrors).finally(() => {
				// If the hosting channel was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
				if (interaction.channel) {
					interaction.deleteReply();
				}
			})
		})
	}
);
