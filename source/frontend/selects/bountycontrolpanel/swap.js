const { MessageFlags, ModalBuilder, TextDisplayBuilder, LabelBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits, bold } = require("discord.js");
const { SelectOptionWrapper } = require("../../classes");
const { ensureBountyExistsAndInteractorIsPoster } = require("./_earlyOuts");
const { emojiFromNumber, truncateTextToLength, butIgnoreInteractionCollectorErrors, unarchiveAndUnlockThread, bountyEmbed, getBountyBoardThread, addCompanyAnnouncementPrefix, isMissingPermissionError } = require("../../shared");
const { Bounty, Hunter } = require("../../../database/models");
const { SelectMenuLimits } = require("@sapphire/discord.js-utilities");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { timeConversion } = require("../../../shared");

module.exports = new SelectOptionWrapper("swap",
	ensureBountyExistsAndInteractorIsPoster(
		async (interaction, origin, runMode, logicLayer, [bounty]) => {
			const startingPosterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
			const bountySlotCount = Hunter.getBountySlotCount(startingPosterLevel, origin.company.maxSimBounties);
			if (bountySlotCount < 2) {
				interaction.reply({ content: "You currently only have 1 bounty slot in this server.", flags: MessageFlags.Ephemeral });
				return;
			}

			const openBounties = await logicLayer.bounties.mapOpenBountiesBySlotNumber(origin.user.id, origin.company.id);
			const slotOptions = [];
			for (let i = 0; i < bountySlotCount; i++) {
				const slotNumber = i + 1;
				if (slotNumber !== bounty.slotNumber) {
					const matchingBounty = openBounties.get(slotNumber);
					const option = { emoji: emojiFromNumber(slotNumber), label: `Slot ${slotNumber} (Base Reward: ${Bounty.calculateCompleterReward(startingPosterLevel, slotNumber, 0)} XP)`, value: slotNumber.toString() };
					if (matchingBounty) {
						option.description = truncateTextToLength(`Swap With: ${matchingBounty.title}`, SelectMenuLimits.MaximumLengthOfDescriptionOfOption);
					}
					slotOptions.push(option);
				}
			}

			const labelIdSlot = "slot";
			const labelIdChannel = "channel";
			const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
				.setTitle("Move Bounty Slots")
				.addTextDisplayComponents(new TextDisplayBuilder().setContent("Swapping this bounty to another slot will change its Base XP Reward."))
				.addLabelComponents(
					new LabelBuilder().setLabel("Bounty Slot")
						.setStringSelectMenuComponent(
							new StringSelectMenuBuilder().setCustomId(labelIdSlot)
								.setPlaceholder("Select a bounty slot...")
								.setOptions(slotOptions)
						),
					new LabelBuilder().setLabel("Announcement Channel")
						.setChannelSelectMenuComponent(
							new ChannelSelectMenuBuilder().setCustomId(labelIdChannel)
								.setPlaceholder("Select a channel...")
								.setChannelTypes(ChannelType.GuildText)
						)
				);
			await interaction.showModal(modal);
			const modalSubmission = await interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") })
				.catch(butIgnoreInteractionCollectorErrors);
			if (!modalSubmission) {
				return;
			}

			/** Unnecessary Validations
			 * - "bounty existence", "posting thread existence"; if a bounty thread (or the bounty, which cascades the delete to the thread) is deleted while its modal is open, the modal does not submit
			 * - "same slot"; slot filtered out of options before input
			 */
			await bounty.reload();
			if (bounty.state !== "open") {
				modalSubmission.reply({ content: "This bounty appears to already have been completed.", flags: MessageFlags.Ephemeral });
				return;
			}

			const destinationSlot = Number(modalSubmission.fields.getStringSelectValues(labelIdSlot)[0]);

			await origin.company.reload();
			const currentPosterLevel = (await origin.hunter.reload()).getLevel(origin.company.xpCoefficient);
			if (destinationSlot > Hunter.getBountySlotCount(currentPosterLevel, origin.company.maxSimBounties)) {
				modalSubmission.reply({ content: "You no longer have the bounty slot you are trying to swap into.", flags: MessageFlags.Ephemeral });
				return;
			}

			const sourceSlot = bounty.slotNumber;
			let destinationBounty = await logicLayer.bounties.findBounty({ slotNumber: destinationSlot, userId: origin.user.id, companyId: origin.company.id, state: "open" });
			const destinationRewardValue = Bounty.calculateCompleterReward(currentPosterLevel, destinationSlot, bounty.showcaseCount);
			const auditLogReason = destinationBounty ?
				`bounty poster swapped slots of bounties ${sourceSlot} and ${destinationSlot}` :
				`bounty swapped from slot ${sourceSlot} to ${destinationSlot} by poster`;

			bounty = await bounty.update({ slotNumber: destinationSlot });
			if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
				modalSubmission.message.edit({ embeds: [bountyEmbed(bounty, modalSubmission.member, currentPosterLevel, false, origin.company, await logicLayer.bounties.getHunterIdSet(bounty.id), await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))] });
				await unarchiveAndUnlockThread(modalSubmission.channel, auditLogReason);
			}
			if (modalSubmission.channel.sendable) {
				modalSubmission.reply({ content: `This bounty's slot was switched from ${sourceSlot} to ${destinationSlot}. It is now worth ${destinationRewardValue} XP.`, flags: MessageFlags.SuppressNotifications });
			}

			if (destinationBounty) {
				destinationBounty = await destinationBounty.update({ slotNumber: sourceSlot });
				const destinationBountyThread = await getBountyBoardThread(modalSubmission.guild, origin.company.bountyBoardId, destinationBounty.postingId);
				if (destinationBountyThread) {
					if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
						(await destinationBountyThread.fetchStarterMessage()).edit({ embeds: [bountyEmbed(bounty, modalSubmission.guild, currentPosterLevel, false, origin.company, await logicLayer.bounties.getHunterIdSet(destinationBounty.id), await destinationBounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))] });
						await unarchiveAndUnlockThread(destinationBountyThread, auditLogReason);
					}
					if (destinationBountyThread.sendable) {
						destinationBountyThread.send({ content: `This bounty's slot was switched from ${destinationSlot} to ${sourceSlot}. It is now worth ${Bounty.calculateCompleterReward(currentPosterLevel, sourceSlot, destinationBounty.showcaseCount)} XP.`, flags: MessageFlags.SuppressNotifications });
					}
				}
			}

			const channel = modalSubmission.fields.getSelectedChannels(labelIdChannel).first();
			channel.send(addCompanyAnnouncementPrefix(origin.company, { content: `${modalSubmission.member}'s bounty, ${bold(bounty.title)} is now worth ${destinationRewardValue} XP.` }))
				.catch(error => {
					if (isMissingPermissionError) {
						modalSubmission.followUp({ content: `Your bounty swap could not be announced in ${channel} because ${modalSubmission.client.user} doesn't have permission to view or send messages in that channel.`, flags: MessageFlags.Ephemeral });
					} else {
						console.error(error);
					}
				});
		}
	)
);
