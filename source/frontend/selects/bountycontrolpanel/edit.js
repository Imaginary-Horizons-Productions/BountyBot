const { MessageFlags, PermissionFlagsBits } = require("discord.js");
const { SelectOptionWrapper } = require("../../classes");
const { validateScheduledEventTimestamps, bountyScheduledEventPayload, refreshBountyBoardThread, unarchiveAndUnlockThread, editBountyModalAndSubmissionOptions, textsHaveAutoModInfraction, bountyEmbed } = require("../../shared");
const { ensureBountyExistsAndInteractorIsPoster } = require("./_earlyOuts");

module.exports = new SelectOptionWrapper("edit",
	ensureBountyExistsAndInteractorIsPoster(
		async (interaction, origin, runMode, logicLayer, [bounty]) => {
			const { modal, inputIds, submissionOptions } = editBountyModalAndSubmissionOptions(bounty, await bounty.getScheduledEvent(interaction.guild.scheduledEvents), false, interaction.id);
			interaction.showModal(modal).then(() => interaction.awaitModalSubmit(submissionOptions)).then(async modalSubmission => {
				await bounty.reload();
				const errors = [];

				const title = modalSubmission.fields.getTextInputValue(inputIds.title);
				const description = modalSubmission.fields.getTextInputValue(inputIds.description);
				const autoModInfraction = await textsHaveAutoModInfraction(modalSubmission.channel, modalSubmission.member, [title, description], "edit bounty");
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
					modalSubmission.reply({ content: `The following errors were encountered while editing your bounty ${bold(title)}:\n• ${errors.join("\n• ")}`, flags: MessageFlags.Ephemeral });
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

				// update bounty board
				const auditLogReason = "bounty edited by poster";
				if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
					refreshBountyBoardThread(modalSubmission.message, { title: bounty.title, embed: bountyEmbed(bounty, modalSubmission.member, origin.hunter.getLevel(origin.company.xpCoefficient), false, origin.company, await logicLayer.bounties.getHunterIdSet(bounty.id), event) }, auditLogReason);
					await unarchiveAndUnlockThread(modalSubmission.channel, "Unarchived to update posting");
				}
				if (modalSubmission.channel.sendable) {
					await modalSubmission.reply({ content: "This bounty was edited.", flags: MessageFlags.SuppressNotifications });
				}
			});
		}
	)
);
