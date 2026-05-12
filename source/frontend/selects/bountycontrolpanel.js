const { MessageFlags, ActionRowBuilder, UserSelectMenuBuilder, ComponentType, userMention, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits, ButtonBuilder, StringSelectMenuBuilder, bold, ButtonStyle, TimestampStyles, ModalBuilder, LabelBuilder, TextDisplayBuilder, TextInputBuilder, TextInputStyle, strikethrough } = require('discord.js');
const { SelectWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING, ZERO_WIDTH_WHITE_SPACE } = require('../../constants');
const { timeConversion, discordTimestamp } = require('../../shared');
const { sentenceListEN, randomCongratulatoryPhrase, bountyEmbed, commandMention, syncRankRoles, goalCompletionEmbed, emojiFromNumber, addCompanyAnnouncementPrefix, textsHaveAutoModInfraction, bountyScheduledEventPayload, validateScheduledEventTimestamps, editBountyModalAndSubmissionOptions, unarchiveAndUnlockThread, butIgnoreInteractionCollectorErrors, butIgnoreMissingPermissionErrors, rewardSummary, consolidateHunterReceipts, refreshReferenceChannelScoreboardSeasonal, refreshReferenceChannelScoreboardOverall, isMissingPermissionError, truncateTextToLength, butIgnoreErrorIf, isUnknownGuildScheduledEventError, getBountyBoardThread, threadCanRecieveMessages, refreshBountyBoardThread } = require('../shared');
const { Company, Bounty, Hunter } = require('../../database/models');
const { SelectMenuLimits } = require('@sapphire/discord.js-utilities');
const { bountyPing } = require('../shared/flows/bountyPing');
const { bountyTakeDown } = require('../shared/flows/bountyTakeDown');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "bountycontrolpanel";
module.exports = new SelectWrapper(mainId, 3000,
	/** This select menu accompanies individual bounty threads, providing an interface for the bounty's poster to interact with the bounty */
	async (interaction, origin, runMode, [bountyId]) => {
		let bounty = await logicLayer.bounties.findBounty(bountyId);
		if (!bounty) {
			interaction.reply({ content: "This bounty appears to no longer exist. Has this bounty already been completed?", flags: MessageFlags.Ephemeral })
			return;
		}
		if (bounty.userId !== interaction.user.id) {
			interaction.reply({ content: "Only the bounty's poster can use these commands.", flags: MessageFlags.Ephemeral });
			return;
		}

		switch (interaction.values[0]) {
			case "nochange":
				/* Discord Selects keep their selection after resolving. If a user wants to use the same command
				   twice in a row but doesn't want other changes to be applied (like to fix a typo in a previous
				   edit), they can move the selection to this option to intentionally do nothing.
				*/
				interaction.update({ content: ZERO_WIDTH_WHITE_SPACE });
				break;
			case "recordturnin": {
				const labelIdBountyHunters = "bounty-hunters";
				const maxHunters = 10;
				const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
					.setTitle("Record Bounty Turn-Ins")
					.addLabelComponents(
						new LabelBuilder().setLabel("Bounty Hunters")
							.setUserSelectMenuComponent(
								new UserSelectMenuBuilder().setCustomId(labelIdBountyHunters)
									.setPlaceholder(`Select up to ${maxHunters} bounty hunters...`)
									.setMaxValues(maxHunters)
							)
					);
				await interaction.showModal(modal);
				const modalSubmission = await interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") })
					.catch(butIgnoreInteractionCollectorErrors);
				if (!modalSubmission) {
					return;
				}

				// Unnecessary Validations: "bounty existence", "posting thread existence"; if a bounty thread (or the bounty, which cascades the delete to the thread) is deleted while its modal is open, the modal does not submit
				await bounty.reload();
				if (bounty.state !== "open") {
					modalSubmission.reply({ content: "This bounty no longer appears to be open.", flags: MessageFlags.Ephemeral });
					return;
				}

				const { eligibleTurnInIds, newTurnInIds, bannedTurnInIds } = await logicLayer.bounties.checkTurnInEligibility(bounty, Array.from(modalSubmission.fields.getSelectedMembers(labelIdBountyHunters).values()), runMode);
				if (newTurnInIds.size < 1) {
					modalSubmission.reply({ content: `No new turn-ins were able to be recorded. You cannot credit yourself or bots for your own bounties. ${bannedTurnInIds.length ? ' The completer(s) mentioned are currently banned.' : ''}`, flags: MessageFlags.Ephemeral });
					return;
				}

				await logicLayer.bounties.bulkCreateCompletions(bounty.id, bounty.companyId, Array.from(eligibleTurnInIds), null);

				if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
					modalSubmission.message.edit({ embeds: [bountyEmbed(bounty, modalSubmission.member, origin.hunter.getLevel(origin.company.xpCoefficient), false, origin.company, eligibleTurnInIds, await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))] });
					await unarchiveAndUnlockThread(modalSubmission.channel, "bounty turn-ins recorded by poster");
				}
				if (threadCanRecieveMessages(modalSubmission.channel)) {
					modalSubmission.reply({ content: `${sentenceListEN(Array.from(newTurnInIds.values().map(id => userMention(id))))} ${newTurnInIds.size === 1 ? "has" : "have"} turned in this bounty! ${randomCongratulatoryPhrase()}!` });
				}
			} break;
			case "revoketurnin": {
				const labelIdBountyHunters = "bounty-hunters";
				const maxHunters = 10;
				const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
					.setTitle("Revoke Bounty Turn-Ins")
					.addLabelComponents(
						new LabelBuilder().setLabel("Bounty Hunters")
							.setUserSelectMenuComponent(
								new UserSelectMenuBuilder().setCustomId(labelIdBountyHunters)
									.setPlaceholder(`Select up to ${maxHunters} bounty hunters...`)
									.setMaxValues(maxHunters)
							)
					);
				await interaction.showModal(modal);
				const modalSubmission = await interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") })
					.catch(butIgnoreInteractionCollectorErrors);
				if (!modalSubmission) {
					return;
				}

				// Unnecessary Validations: "bounty existence", "posting thread existence"; if a bounty thread (or the bounty, which cascades the delete to the thread) is deleted while its modal is open, the modal does not submit
				await bounty.reload();
				if (bounty.state !== "open") {
					modalSubmission.reply({ content: "This bounty no longer appears to be open.", flags: MessageFlags.Ephemeral });
					return;
				}

				const removedIds = modalSubmission.fields.getSelectedMembers(labelIdBountyHunters).map((_, key) => key);
				await logicLayer.bounties.deleteSelectedBountyCompletions(bountyId, removedIds);

				if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
					modalSubmission.message.edit({ embeds: [bountyEmbed(bounty, modalSubmission.member, origin.hunter.getLevel(origin.company.xpCoefficient), false, origin.company, await logicLayer.bounties.getHunterIdSet(bountyId), await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))] });
					await unarchiveAndUnlockThread(modalSubmission.channel, "bounty turn-ins revoked by poster");
				}
				if (threadCanRecieveMessages(modalSubmission.channel)) {
					modalSubmission.reply({ content: `${sentenceListEN(removedIds.map(id => userMention(id)))} ${removedIds.length === 1 ? "has" : "have"} been removed as ${removedIds.length === 1 ? "a completer" : "completers"} of this bounty.` });
				}
			} break;
			case "showcase": {
				const nextShowcaseInMS = new Date(origin.hunter.lastShowcaseTimestamp).valueOf() + timeConversion(1, "w", "ms");
				if (runMode === "production" && Date.now() < nextShowcaseInMS) {
					interaction.reply({ content: `You can showcase another bounty in ${discordTimestamp(Math.floor(nextShowcaseInMS / 1000), TimestampStyles.RelativeTime)}.`, flags: MessageFlags.Ephemeral });
					return;
				}

				const labelIdChannel = "channel";
				const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
					.setTitle("Showcase a Bounty")
					.addTextDisplayComponents(new TextDisplayBuilder().setContent("You can showcase 1 bounty per week. The showcased bounty's XP reward will be increased."))
					.addLabelComponents(
						new LabelBuilder().setLabel("Channel")
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

				// Unnecessary Validations: "bounty existence", "posting thread existence"; if a bounty thread (or the bounty, which cascades the delete to the thread) is deleted while its modal is open, the modal does not submit
				const channel = modalSubmission.fields.getSelectedChannels(labelIdChannel).first();
				if (!channel.members.has(modalSubmission.client.user.id)) {
					modalSubmission.reply({ content: "BountyBot is not in the selected channel.", flags: MessageFlags.Ephemeral });
					return;
				}

				if (!channel.permissionsFor(modalSubmission.user.id).has(PermissionFlagsBits.ViewChannel & PermissionFlagsBits.SendMessages)) {
					modalSubmission.reply({ content: "You must have permission to view and send messages in the selected channel to showcase a bounty in it.", flags: MessageFlags.Ephemeral });
					return;
				}

				await bounty.reload();
				if (bounty.state !== "open") {
					modalSubmission.reply({ content: "The selected bounty does not seem to be open.", flags: MessageFlags.Ephemeral });
					return;
				}

				bounty = await bounty.increment("showcaseCount");
				await origin.hunter.update({ lastShowcaseTimestamp: new Date() });
				const currentPosterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
				const embeds = [bountyEmbed(bounty, modalSubmission.member, currentPosterLevel, false, origin.company, await logicLayer.bounties.getHunterIdSet(bountyId), await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))];

				channel.send({ content: `${modalSubmission.member} increased the reward on their bounty!`, embeds });

				if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
					modalSubmission.message.edit({ embeds });
					await unarchiveAndUnlockThread(modalSubmission.channel, "bounty showcased by poster");
				}
				if (threadCanRecieveMessages(modalSubmission.channel)) {
					modalSubmission.reply({ content: `${modalSubmission.member} increased the reward on this bounty!` });
				}
			} break;
			case "ping":
				const labelIdMessage = "message";
				const labelIdExcludedBountyHunters = "bounty-hunters";
				const maxHunters = 10;
				const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
					.setTitle("Ping Interested Bounty Hunters")
					.addLabelComponents(
						new LabelBuilder().setLabel("Message")
							.setTextInputComponent(
								new TextInputBuilder().setCustomId(labelIdMessage)
									.setStyle(TextInputStyle.Short)
									.setPlaceholder("Add a message to go with the ping...")
							),
						new LabelBuilder().setLabel("Hunters to Exclude")
							.setUserSelectMenuComponent(
								new UserSelectMenuBuilder().setCustomId(labelIdExcludedBountyHunters)
									.setPlaceholder(`Select up to ${maxHunters} bounty hunters...`)
									.setMaxValues(maxHunters)
									.setRequired(false)
							)
					);
				await interaction.showModal(modal);
				const modalSubmission = await interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") })
					.catch(butIgnoreInteractionCollectorErrors);
				if (!modalSubmission) {
					return;
				}

				bounty = await logicLayer.bounties.findBounty(bountyId);
				if (!bounty || bounty.state !== "open") {
					modalSubmission.reply({ content: "Your selected bounty could not be found.", flags: MessageFlags.Ephemeral });
					return;
				}

				bountyPing(modalSubmission, { message: labelIdMessage, excludedBountyHunters: labelIdExcludedBountyHunters }, bounty, interaction.channel);
				break;
			case "complete": {
				// disallow completion within 5 minutes of creating bounty
				if (runMode === "production" && new Date() < new Date(new Date(bounty.createdAt) + timeConversion(5, "m", "ms"))) {
					interaction.reply({ content: `Bounties cannot be completed within 5 minutes of their posting. You can ${commandMention("bounty record-turn-ins")} so you won't forget instead.`, flags: MessageFlags.Ephemeral });
					return;
				}

				const completions = await logicLayer.bounties.findBountyCompletions(bounty.id);
				const memberCollection = await interaction.guild.members.fetch({ user: completions.map(reciept => reciept.userId) });
				const validatedHunters = new Map();
				const pendingTurnInDisplayNames = [];
				for (const [memberId, member] of memberCollection) {
					if (runMode !== "production" || !member.user.bot) {
						const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(memberId, origin.company.id);
						if (!hunter.isBanned) {
							validatedHunters.set(memberId, hunter);
							pendingTurnInDisplayNames.push(member.displayName);
						}
					}
				}

				const labelIdChannel = "channel";
				const labelIdBountyHunters = "bounty-hunters";
				const maxHunters = 10;
				const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
					.setTitle("Mark your Bounty Complete!")
					.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Pending Turn-Ins: ${pendingTurnInDisplayNames.length > 0 ? sentenceListEN(pendingTurnInDisplayNames) : "None yet!"}`))
					.addLabelComponents(
						new LabelBuilder().setLabel("Channel")
							.setChannelSelectMenuComponent(
								new ChannelSelectMenuBuilder().setCustomId(labelIdChannel)
									.setPlaceholder("Select a channel...")
									.setChannelTypes(ChannelType.GuildText)
							),
						new LabelBuilder().setLabel("Extra Turn-Ins")
							.setUserSelectMenuComponent(
								new UserSelectMenuBuilder().setCustomId(labelIdBountyHunters)
									.setPlaceholder(`Select up to ${maxHunters} bounty hunters...`)
									.setMaxValues(maxHunters)
									.setRequired(false)
							)
					);
				await interaction.showModal(modal);
				const modalSubmission = await interaction.awaitModalSubmit({ filter: incoming => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") })
					.catch(butIgnoreInteractionCollectorErrors);
				if (!modalSubmission) {
					return;
				}

				// Early-out if no completers
				const extraTurnIns = modalSubmission.fields.getSelectedMembers(labelIdBountyHunters);
				if (extraTurnIns !== null) {
					for (const [memberId, member] of extraTurnIns) {
						if (runMode !== "production" || !(member.user.bot || validatedHunters.has(memberId))) {
							const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(memberId, origin.company.id);
							if (!hunter.isBanned) {
								validatedHunters.set(memberId, hunter);
							}
						}
					}
				}
				if (validatedHunters.size < 1) {
					modalSubmission.reply({ content: `There aren't any eligible bounty hunters to credit with completing this bounty. If you'd like to close your bounty without crediting anyone, use ${commandMention("bounty take-down")}.`, flags: MessageFlags.Ephemeral })
					return;
				}

				if (threadCanRecieveMessages(modalSubmission.channel)) {
					await modalSubmission.deferReply({ flags: MessageFlags.SuppressNotifications });
				}
				const season = await logicLayer.seasons.incrementSeasonStat(bounty.companyId, "bountiesCompleted");

				let hunterMap = await logicLayer.hunters.getCompanyHunterMap(origin.company.id);
				const previousCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
				const hunterReceipts = await logicLayer.bounties.completeBounty(bounty, hunterMap.get(bounty.userId), validatedHunters, season, origin.company);
				const { companyReceipt, goalProgress } = await logicLayer.goals.progressGoal(origin.company, "bounties", hunterMap.get(bounty.userId), season);
				companyReceipt.guildName = modalSubmission.guild.name;

				hunterMap = await logicLayer.hunters.getCompanyHunterMap(origin.company.id);
				const currentCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
				if (previousCompanyLevel < currentCompanyLevel) {
					companyReceipt.levelUp = currentCompanyLevel;
				}
				const descendingRanks = await logicLayer.ranks.findAllRanks(origin.company.id);
				const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
				const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks, await modalSubmission.guild.roles.fetch());
				syncRankRoles(seasonalHunterReceipts, descendingRanks, modalSubmission.guild.members);
				consolidateHunterReceipts(hunterReceipts, seasonalHunterReceipts);

				await modalSubmission.editReply({ content: rewardSummary("bounty", companyReceipt, hunterReceipts, origin.company.maxSimBounties) });

				const auditLogReason = "bounty marked completed by poster";
				if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
					refreshBountyBoardThread(modalSubmission.message, { title: strikethrough(bounty.title), embed: bountyEmbed(bounty, modalSubmission.member, hunterMap.get(bounty.userId).getLevel(origin.company.xpCoefficient), true, origin.company, new Set(validatedHunters.keys()), await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents), goalProgress) }, auditLogReason);
					await unarchiveAndUnlockThread(modalSubmission.channel, auditLogReason);
				}
				modalSubmission.channel.edit({ archived: true, appliedTags: [origin.company.bountyBoardCompletedTagId], reason: auditLogReason });

				const announcementOptions = { content: `${userMention(bounty.userId)}'s bounty, ${modalSubmission.channel}, was completed!` };
				if (goalProgress.goalCompleted) {
					announcementOptions.embeds = [goalCompletionEmbed(goalProgress.contributorIds)];
				}
				modalSubmission.fields.getSelectedChannels(labelIdChannel).first().send(announcementOptions).catch(butIgnoreMissingPermissionErrors);
				if (origin.company.scoreboardIsSeasonal) {
					refreshReferenceChannelScoreboardSeasonal(origin.company, modalSubmission.guild, participationMap, descendingRanks, goalProgress);
				} else {
					refreshReferenceChannelScoreboardOverall(origin.company, modalSubmission.guild, hunterMap, goalProgress);
				}

				if (bounty.scheduledEventId) {
					modalSubmission.guild.scheduledEvents.delete(bounty.scheduledEventId).catch(butIgnoreErrorIf(isUnknownGuildScheduledEventError, isMissingPermissionError));
				}
			} break;
			case "edit": {
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
						const eventPayload = bountyScheduledEventPayload(title, modalSubmission.member.displayName, bounty.slotNumber, description, updatePayload.attachmentURL, startTimestamp, endTimestamp);
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

					// update bounty board
					const auditLogReason = "bounty edited by poster";
					if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
						refreshBountyBoardThread(modalSubmission.message, { title: bounty.title, embed }, auditLogReason);
						await unarchiveAndUnlockThread(modalSubmission.channel, "Unarchived to update posting");
					}
					if (threadCanRecieveMessages(modalSubmission.channel)) {
						await modalSubmission.reply({ content: "This bounty was edited.", flags: MessageFlags.SuppressNotifications });
						modalSubmission.followUp({ content: `You can use ${commandMention("bounty showcase")} to let other bounty hunters know about the changes.`, embeds: [embed], flags: MessageFlags.Ephemeral })
					}
				});
			} break;
			case "swap": {
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
					modalSubmission.message.edit({ embeds: [bountyEmbed(bounty, modalSubmission.guild, currentPosterLevel, false, origin.company, await logicLayer.bounties.getHunterIdSet(bounty.id), await bounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))] });
					await unarchiveAndUnlockThread(modalSubmission.channel, auditLogReason);
				}
				if (threadCanRecieveMessages(modalSubmission.channel)) {
					modalSubmission.channel.send({ content: `This bounty's slot was switched from ${sourceSlot} to ${destinationSlot}. It is now worth ${destinationRewardValue} XP.`, flags: MessageFlags.SuppressNotifications });
				}

				if (destinationBounty) {
					destinationBounty = await destinationBounty.update({ slotNumber: sourceSlot });
					const destinationBountyThread = await getBountyBoardThread(modalSubmission.guild, origin.company.bountyBoardId, destinationBounty.postingId);
					if (destinationBountyThread) {
						if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.ManageThreads)) {
							(await destinationBountyThread.fetchStarterMessage()).edit({ embeds: [bountyEmbed(bounty, modalSubmission.guild, currentPosterLevel, false, origin.company, await logicLayer.bounties.getHunterIdSet(destinationBounty.id), await destinationBounty.getScheduledEvent(modalSubmission.guild.scheduledEvents))] });
							await unarchiveAndUnlockThread(destinationBountyThread, auditLogReason);
						}
						if (threadCanRecieveMessages(destinationBountyThread)) {
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
			} break;
			case "takedown": {
				interaction.reply({
					content: `Really take down this bounty?`,
					components: [
						new ActionRowBuilder().addComponents(
							new ButtonBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}confirm`)
								.setStyle(ButtonStyle.Success)
								.setEmoji("✔")
								.setLabel("Confirm")
						)
					],
					flags: MessageFlags.Ephemeral,
					withResponse: true
				}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.Button })).then(async collectedInteraction => {
					await collectedInteraction.update({ content: "Your bounty has been taken down.", components: [] });
					bountyTakeDown(logicLayer, collectedInteraction.guild, bounty, origin.hunter, collectedInteraction.channel);
				}).catch(butIgnoreInteractionCollectorErrors);
			} break;
		}
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
