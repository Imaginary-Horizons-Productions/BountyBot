const { StringSelectMenuBuilder, MessageFlags, TimestampStyles, ModalBuilder, TextDisplayBuilder, LabelBuilder, PermissionFlagsBits } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { timeConversion, discordTimestamp } = require("../../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { selectOptionsFromBounties, bountyEmbed, unarchiveAndUnlockThread, butIgnoreInteractionCollectorErrors, getBountyBoardThread } = require("../../shared");
const { ensureHunterHasOpenBounty } = require("../_earlyOuts");
const { RunModeKind } = require("../../../shared/types");

module.exports = new SubcommandWrapper("showcase", "Show the embed for one of your existing bounties and increase the reward",
	ensureHunterHasOpenBounty(async function executeSubcommand(interaction, origin, runMode, logicLayer, bounties) {
		const nextShowcaseInMS = new Date(origin.hunter.lastShowcaseTimestamp).valueOf() + timeConversion(1, "w", "ms");
		if (runMode !== RunModeKind.Development && Date.now() < nextShowcaseInMS) {
			interaction.reply({ content: `You can showcase another bounty in ${discordTimestamp(Math.floor(nextShowcaseInMS / 1000), TimestampStyles.RelativeTime)}.`, flags: MessageFlags.Ephemeral });
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
							.setOptions(selectOptionsFromBounties(bounties))
					)
			);
		await interaction.showModal(modal);
		const modalSubmission = await interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") })
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
		const currentPosterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
		const embed = bountyEmbed(bounty, modalSubmission.member, currentPosterLevel, false, origin.company, await logicLayer.bounties.getHunterIdSet(bountyId), await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents));
		const bountyThread = await getBountyBoardThread(modalSubmission.guild, origin.company.bountyBoardId, bounty.postingId);

		modalSubmission.reply({ content: `${modalSubmission.member} increased the reward on their bounty!`, embeds: [embed] });

		if (bountyThread) {
			if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
				(await bountyThread.fetchStarterMessage()).edit({ embeds: [embed] });
				await unarchiveAndUnlockThread(bountyThread, "bounty showcased by poster");
			}
			if (bountyThread.sendable) {
				bountyThread.send({ content: `${modalSubmission.member} increased the reward on this bounty!`, flags: MessageFlags.SuppressNotifications });
			}
		}
	})
);
