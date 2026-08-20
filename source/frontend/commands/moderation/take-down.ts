import { ActionRowBuilder, bold, ComponentType, MessageFlags, SlashCommandUserOption, StringSelectMenuBuilder, userMention } from "discord.js";
import { SKIP_INTERACTION_HANDLING } from "../../../shared/constants";
import { SubcommandFunctionality } from "../../classes";
import { butIgnoreInteractionCollectorErrors, getBountyBoardThread, selectOptionsFromBounties, syncRankRoles } from "../../shared";

const posterOption = new SlashCommandUserOption().setName("poster")
	.setDescription("The mention of the poster of the bounty")
	.setRequired(true);

export default new SubcommandFunctionality("take-down", "Take down another user's bounty",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		const poster = interaction.options.getUser(posterOption.name, true);
		const openBounties = await logicLayer.bounties.findOpenBounties(poster.id, interaction.guild.id);
		if (openBounties.length < 1) {
			interaction.reply({ content: `${poster} doesn't seem to have any open bounties at the moment.`, flags: MessageFlags.Ephemeral });
			return;
		}

		interaction.reply({
			content: "The poster will also lose the XP they gained for posting the removed bounty.",
			components: [
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
					new StringSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
						.setPlaceholder("Select a bounty to take down...")
						.setOptions(selectOptionsFromBounties(openBounties))
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
			const bounty = await logicLayer.bounties.findBounty(collectedInteraction.values[0]);
			if (!bounty) {
				collectedInteraction.reply({ content: "The selected bounty seems to already have been taken down.", flags: MessageFlags.Ephemeral });
				return;
			}

			logicLayer.bounties.deleteBountyCompletions(bounty.id);
			bounty.update({ state: "deleted" });
			const bountyThread = await getBountyBoardThread(interaction.guild, theater.company.bountyBoardId, bounty.postingId);
			if (bountyThread) {
				bountyThread.delete(`bounty taken down by moderator (id: ${interaction.user.id})`);
			}
			if (bounty.scheduledEventId) {
				collectedInteraction.guild.scheduledEvents.delete(bounty.scheduledEventId);
			}

			let poster;
			if (bounty.userId === theater.hunter.userId) {
				poster = theater.hunter;
			} else {
				poster = (await logicLayer.hunters.findOrCreateBountyHunter(bounty.userId, interaction.guild.id)).hunter[0];
			}
			poster.decrement("xp");
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
			await logicLayer.seasons.changeSeasonXP(bounty.userId, interaction.guildId, season.id, -1);
			const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
			const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(await logicLayer.seasons.getParticipationMap(season.id), descendingRanks, await interaction.guild.roles.fetch());
			syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);
			collectedInteraction.reply({ content: `${userMention(bounty.userId)}'s bounty ${bold(bounty.title)} has been taken down by ${interaction.member}.` });
		}).catch(butIgnoreInteractionCollectorErrors).finally(() => {
			// If the hosting channel was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
			if (interaction.channel) {
				interaction.deleteReply();
			}
		})
	}
).setOptions(posterOption);
