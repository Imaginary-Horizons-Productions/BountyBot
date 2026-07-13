const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType, userMention, bold } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { SAFE_DELIMITER, SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { selectOptionsFromBounties, syncRankRoles, butIgnoreInteractionCollectorErrors, getBountyBoardThread } = require("../../shared");

module.exports = new SubcommandWrapper("take-down", "Take down another user's bounty",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		const poster = interaction.options.getUser("poster");
		const openBounties = await logicLayer.bounties.findOpenBounties(poster.id, interaction.guild.id);
		if (openBounties.length < 1) {
			interaction.reply({ content: `${poster} doesn't seem to have any open bounties at the moment.`, flags: MessageFlags.Ephemeral });
			return;
		}

		interaction.reply({
			content: "The poster will also lose the XP they gained for posting the removed bounty.",
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${SAFE_DELIMITER}${poster.id}`)
						.setPlaceholder("Select a bounty to take down...")
						.setOptions(selectOptionsFromBounties(openBounties))
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
			const posterId = collectedInteraction.customId.split(SAFE_DELIMITER)[1];
			const [bountyId] = collectedInteraction.values;
			openBounties.find(bounty => bounty.id === bountyId).reload().then(async bounty => {
				logicLayer.bounties.deleteBountyCompletions(bountyId);
				bounty.update({ state: "deleted" });
				const bountyThread = await getBountyBoardThread(interaction.guild, theater.company.bountyBoardId, bounty.postingId);
				if (bountyThread) {
					bountyThread.delete(`bounty taken down by moderator (id: ${interaction.user.id})`);
				}
				if (bounty.scheduledEventId) {
					collectedInteraction.guild.scheduledEvents.delete(bounty.scheduledEventId);
				}

				let poster;
				if (posterId === theater.hunter.userId) {
					poster = theater.hunter;
				} else {
					poster = (await logicLayer.hunters.findOrCreateBountyHunter(posterId, interaction.guild.id)).hunter[0];
				}
				poster.decrement("xp");
				const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
				await logicLayer.seasons.changeSeasonXP(posterId, interaction.guildId, season.id, -1);
				const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
				const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(await logicLayer.seasons.getParticipationMap(season.id), descendingRanks, await interaction.guild.roles.fetch());
				syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);
				collectedInteraction.reply({ content: `${userMention(posterId)}'s bounty ${bold(bounty.title)} has been taken down by ${interaction.member}.` });
			});
		}).catch(butIgnoreInteractionCollectorErrors).finally(() => {
			// If the hosting channel was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
			if (interaction.channel) {
				interaction.deleteReply();
			}
		})
	}
).setOptions(
	{
		type: "User",
		name: "poster",
		description: "The mention of the poster of the bounty",
		required: true
	}
);
