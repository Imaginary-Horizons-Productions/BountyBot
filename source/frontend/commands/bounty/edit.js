const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType, unorderedList, bold, PermissionFlagsBits } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { textsHaveAutoModInfraction, commandMention, bountyEmbed, validateScheduledEventTimestamps, bountyScheduledEventPayload, editBountyModalAndSubmissionOptions, selectOptionsFromBounties, unarchiveAndUnlockThread, butIgnoreInteractionCollectorErrors, getBountyBoardThread, refreshBountyBoardThread } = require("../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { ensureHunterHasOpenBounty } = require("../_earlyOuts");

module.exports = new SubcommandWrapper("edit", "Edit the title, description, image, or time of one of your bounties",
	ensureHunterHasOpenBounty(async function executeSubcommand(interaction, origin, runMode, logicLayer, openBounties) {
		interaction.reply({
			content: "You can select one of your open bounties to edit below.\n\nKeep in mind that while you're in charge of adding completers and ending the bounty, the bounty is still subject to server rules and moderation.",
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
						.setPlaceholder("Select a bounty to edit...")
						.setOptions(selectOptionsFromBounties(openBounties))
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
			const [bountyId] = collectedInteraction.values;
			// Verify bounty exists
			const bounty = await logicLayer.bounties.findBounty(bountyId);
			if (bounty?.state !== "open") {
				interaction.update({ content: `The selected bounty doesn't seem to be open.`, components: [] });
				return;
			}

			const { modal, inputIds, submissionOptions } = editBountyModalAndSubmissionOptions(bounty, await bounty.getScheduledEvent(collectedInteraction.guild.scheduledEvents), false, interaction.id);
			collectedInteraction.showModal(modal);
			return interaction.awaitModalSubmit(submissionOptions).then(async modalSubmission => {
				await bounty.reload();
				const errors = [];

				const title = modalSubmission.fields.getTextInputValue(inputIds.title);
				const description = modalSubmission.fields.getTextInputValue(inputIds.description);
				const autoModInfraction = await textsHaveAutoModInfraction(modalSubmission.channel, modalSubmission.member, [title, description], "edit bounty")
				if (autoModInfraction == null) {
					errors.push(`Could not check if the toast breaks automod rules. ${modalSubmission.client.user} may not have the Manage Server permission required to check the automod rules.`);
				} else if (autoModInfraction) {
					errors.push("The bounty's new title or description would trip this server's AutoMod.");
				}

				const startTimestamp = parseInt(modalSubmission.fields.getTextInputValue(inputIds.startTimestamp));
				const endTimestamp = parseInt(modalSubmission.fields.getTextInputValue(inputIds.endTimestamp));
				if (startTimestamp || endTimestamp) {
					errors.push(...validateScheduledEventTimestamps(startTimestamp, endTimestamp));
				}

				if (errors.length > 0) {
					interaction.deleteReply();
					modalSubmission.reply({ content: `The following errors were encountered while editing your bounty ${bold(title)}:\n${unorderedList(errors)}`, flags: MessageFlags.Ephemeral });
					return;
				}

				const updatePayload = { editCount: bounty.editCount + 1 };
				if (title) {
					updatePayload.title = title;
				}

				updatePayload.description = description;

				const imageAttachmentCollection = modalSubmission.fields.getUploadedFiles(inputIds.image);
				if (imageAttachmentCollection) {
					const firstAttachment = imageAttachmentCollection.first();
					if (firstAttachment) {
						updatePayload.attachmentURL = firstAttachment.url;
					} else {
						updatePayload.attachmentURL = null;
					}
				} else {
					updatePayload.attachmentURL = null;
				}

				let event = null;
				if (startTimestamp && endTimestamp) {
					const eventPayload = bountyScheduledEventPayload(title, modalSubmission.member.displayName, bounty.slotNumber, startTimestamp, endTimestamp, description, updatePayload.attachmentURL);
					if (bounty.scheduledEventId) {
						event = await modalSubmission.guild.scheduledEvents.edit(bounty.scheduledEventId, eventPayload);
					} else {
						event = await modalSubmission.guild.scheduledEvents.create(eventPayload);
						updatePayload.scheduledEventId = event.id;
					}
				} else if (bounty.scheduledEventId) {
					modalSubmission.guild.scheduledEvents.delete(bounty.scheduledEventId);
					updatePayload.scheduledEventId = null;
				}
				await bounty.update(updatePayload);

				const embed = bountyEmbed(bounty, modalSubmission.member, origin.hunter.getLevel(origin.company.xpCoefficient), false, origin.company, await logicLayer.bounties.getHunterIdSet(bountyId), event);
				modalSubmission.update({ content: `Bounty edited! You can use ${commandMention("bounty showcase")} to let other bounty hunters know about the changes.`, embeds: [embed], components: [] });

				// update bounty board
				const auditLogReason = "bounty edited by poster";
				const bountyThread = await getBountyBoardThread(modalSubmission.guild, origin.company.bountyBoardId, bounty.postingId);
				if (bountyThread) {
					if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
						refreshBountyBoardThread(await bountyThread.fetchStarterMessage(), { embed }, auditLogReason);
						await unarchiveAndUnlockThread(bountyThread, auditLogReason);
					}
					if (bountyThread.sendable) {
						bountyThread.send({ content: "This bounty was edited.", flags: MessageFlags.SuppressNotifications });
					}
				}
			});
		}).catch(butIgnoreInteractionCollectorErrors);
	})
);
