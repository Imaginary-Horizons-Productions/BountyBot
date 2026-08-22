import { SelectMenuLimits } from "@sapphire/discord.js-utilities";
import type { SelectMenuComponentOptionData } from "discord.js";
import { ChannelSelectMenuBuilder, ChannelType, LabelBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, StringSelectMenuBuilder, TextDisplayBuilder, bold } from "discord.js";
import { DatabaseTypes } from "../../../database/index.ts";
import { SKIP_INTERACTION_HANDLING } from "../../../shared/constants.ts";
import { timeConversion } from "../../../shared/index.ts";
import { BountyState } from "../../../shared/types.ts";
import { SelectOptionFunctionality } from "../../classes/index.ts";
import { addCompanyAnnouncementPrefix, bountyEmbed, butIgnoreInteractionCollectorErrors, emojiFromNumber, getBountyBoardThread, isMissingPermissionError, truncateTextToLength, unarchiveAndUnlockThread } from "../../shared/index.ts";
import { ensureBountyExistsAndInteractorIsPoster } from "./_earlyOuts.ts";

export default new SelectOptionFunctionality("swap",
	ensureBountyExistsAndInteractorIsPoster(
		async (interaction, theater, isDevMode, logicLayer, [bounty]) => {
			const startingPosterLevel = theater.hunter.getLevel(theater.company.xpCoefficient);
			const bountySlotCount = DatabaseTypes.Hunter.getBountySlotCount(startingPosterLevel, theater.company.maxSimBounties);
			if (bountySlotCount < 2) {
				interaction.reply({ content: "You currently only have 1 bounty slot in this server.", flags: MessageFlags.Ephemeral });
				return;
			}

			const openBounties = await logicLayer.bounties.mapOpenBountiesBySlotNumber(theater.user.id, theater.company.id);
			const slotOptions: SelectMenuComponentOptionData[] = [];
			for (let i = 0; i < bountySlotCount; i++) {
				const slotNumber = i + 1;
				if (slotNumber !== bounty.slotNumber) {
					const matchingBounty = openBounties.get(slotNumber);
					const option: SelectMenuComponentOptionData = { emoji: emojiFromNumber(slotNumber), label: `Slot ${slotNumber} (Base Reward: ${DatabaseTypes.Bounty.calculateCompleterReward(startingPosterLevel, slotNumber, 0)} XP)`, value: slotNumber.toString() };
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
			if (bounty.state !== BountyState.Open) {
				modalSubmission.reply({ content: "This bounty appears to already have been completed.", flags: MessageFlags.Ephemeral });
				return;
			}

			const destinationSlot = Number(modalSubmission.fields.getStringSelectValues(labelIdSlot)[0]);

			await theater.company.reload();
			const currentPosterLevel = (await theater.hunter.reload()).getLevel(theater.company.xpCoefficient);
			if (destinationSlot > DatabaseTypes.Hunter.getBountySlotCount(currentPosterLevel, theater.company.maxSimBounties)) {
				modalSubmission.reply({ content: "You no longer have the bounty slot you are trying to swap into.", flags: MessageFlags.Ephemeral });
				return;
			}

			const sourceSlot = bounty.slotNumber;
			let destinationBounty = await logicLayer.bounties.findBounty({ slotNumber: destinationSlot, userId: theater.user.id, companyId: theater.company.id, state: BountyState.Open });
			const destinationRewardValue = DatabaseTypes.Bounty.calculateCompleterReward(currentPosterLevel, destinationSlot, bounty.showcaseCount);
			const auditLogReason = destinationBounty ?
				`bounty poster swapped slots of bounties ${sourceSlot} and ${destinationSlot}` :
				`bounty swapped from slot ${sourceSlot} to ${destinationSlot} by poster`;

			bounty = await bounty.update({ slotNumber: destinationSlot });
			if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
				modalSubmission.message.edit({ embeds: [bountyEmbed(bounty, modalSubmission.member, currentPosterLevel, false, theater.company, await logicLayer.bounties.getHunterIdSet(bounty.id), await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))] });
				await unarchiveAndUnlockThread(modalSubmission.channel, auditLogReason);
			}
			if (modalSubmission.channel?.isSendable()) {
				modalSubmission.reply({ content: `This bounty's slot was switched from ${sourceSlot} to ${destinationSlot}. It is now worth ${destinationRewardValue} XP.`, flags: MessageFlags.SuppressNotifications });
			}

			if (destinationBounty) {
				destinationBounty = await destinationBounty.update({ slotNumber: sourceSlot });
				const destinationBountyThread = await getBountyBoardThread(modalSubmission.guild, theater.company.bountyBoardId, destinationBounty.postingId);
				if (destinationBountyThread) {
					if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
						(await destinationBountyThread.fetchStarterMessage()).edit({ embeds: [bountyEmbed(bounty, modalSubmission.guild, currentPosterLevel, false, theater.company, await logicLayer.bounties.getHunterIdSet(destinationBounty.id), await destinationBounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))] });
						await unarchiveAndUnlockThread(destinationBountyThread, auditLogReason);
					}
					if (destinationBountyThread.sendable) {
						destinationBountyThread.send({ content: `This bounty's slot was switched from ${destinationSlot} to ${sourceSlot}. It is now worth ${DatabaseTypes.Bounty.calculateCompleterReward(currentPosterLevel, sourceSlot, destinationBounty.showcaseCount)} XP.`, flags: MessageFlags.SuppressNotifications });
					}
				}
			}

			const channel = modalSubmission.fields.getSelectedChannels(labelIdChannel).first();
			channel.send(addCompanyAnnouncementPrefix(theater.company, { content: `${modalSubmission.member}'s bounty, ${bold(bounty.title)} is now worth ${destinationRewardValue} XP.` }))
				.catch(error => {
					if (isMissingPermissionError(error)) {
						modalSubmission.followUp({ content: `Your bounty swap could not be announced in ${channel} because ${modalSubmission.client.user} doesn't have permission to view or send messages in that channel.`, flags: MessageFlags.Ephemeral });
					} else {
						console.error(error);
					}
				});
		}
	)
);
