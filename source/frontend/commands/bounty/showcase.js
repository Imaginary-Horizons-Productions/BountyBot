const { StringSelectMenuBuilder, MessageFlags, TimestampStyles, ModalBuilder, TextDisplayBuilder, LabelBuilder } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { timeConversion, discordTimestamp } = require("../../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { selectOptionsFromBounties, bountyEmbed, refreshBountyThreadStarterMessage, unarchiveAndUnlockThread, butIgnoreInteractionCollectorErrors, butIgnoreUnknownChannelErrors } = require("../../shared");

module.exports = new SubcommandWrapper("showcase", "Show the embed for one of your existing bounties and increase the reward",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const nextShowcaseInMS = new Date(origin.hunter.lastShowcaseTimestamp).valueOf() + timeConversion(1, "w", "ms");
		if (runMode === "production" && Date.now() < nextShowcaseInMS) {
			interaction.reply({ content: `You can showcase another bounty in ${discordTimestamp(Math.floor(nextShowcaseInMS / 1000), TimestampStyles.RelativeTime)}.`, flags: MessageFlags.Ephemeral });
			return;
		}

		const existingBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guildId);
		if (existingBounties.length < 1) {
			interaction.reply({ content: "You doesn't have any open bounties posted.", flags: MessageFlags.Ephemeral });
			return;
		}

		if (!interaction.channel.members.has(interaction.client.user.id)) {
			interaction.reply({ content: "BountyBot can't post public messages in this channel.", flags: MessageFlags.Ephemeral });
			return;
		}

		const labelIdBountyId = "bounty-id";
		const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
			.setTitle("Showcase a Bounty")
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent("You can showcase 1 bounty per week. The showcased bounty's XP reward will be increased.")
			)
			.addLabelComponents(
				new LabelBuilder().setLabel("Bounty")
					.setStringSelectMenuComponent(
						new StringSelectMenuBuilder().setCustomId(labelIdBountyId)
							.setPlaceholder("Select a bounty...")
							.setOptions(selectOptionsFromBounties(existingBounties))
					)
			);
		await interaction.showModal(modal);
		const modalSubmission = await interaction.awaitModalSubmit({ filter: interaction => interaction.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") })
			.catch(butIgnoreInteractionCollectorErrors);
		if (!modalSubmission) {
			return;
		}

		/** Unnecessary Validations
		 * "user can view and send messages in target channel"
		 * - User could not have sent slash command if unable to view and send messages. In case of input persisting over permission change, a showcase is low enough stakes to allow.
		 */
		const bountyId = modalSubmission.fields.getStringSelectValues(labelIdBountyId)[0];
		let bounty = await logicLayer.bounties.findBounty(bountyId);
		if (bounty.state !== "open") {
			modalSubmission.reply({ content: "The selected bounty does not seem to be open.", flags: MessageFlags.Ephemeral });
			return;
		}

		bounty = await bounty.increment("showcaseCount");
		await origin.hunter.update({ lastShowcaseTimestamp: new Date() });
		const hunterIdSet = await logicLayer.bounties.getHunterIdSet(bountyId);
		const currentPosterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
		const bountyScheduledEvent = await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents);
		refreshBountyThreadStarterMessage(modalSubmission.guild, origin.company, bounty, bountyScheduledEvent, modalSubmission.member, currentPosterLevel, hunterIdSet)
			.catch(butIgnoreUnknownChannelErrors);
		await unarchiveAndUnlockThread(modalSubmission.channel, "bounty showcased");
		modalSubmission.reply({
			content: `${modalSubmission.member} increased the reward on their bounty!`,
			embeds: [bountyEmbed(bounty, modalSubmission.member, currentPosterLevel, false, origin.company, hunterIdSet, bountyScheduledEvent)]
		});
	}
);
