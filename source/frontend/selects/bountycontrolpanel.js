const { MessageFlags, ActionRowBuilder, UserSelectMenuBuilder, ComponentType, userMention, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits, ButtonBuilder, StringSelectMenuBuilder, bold, ButtonStyle, TimestampStyles } = require('discord.js');
const { SelectWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING, ZERO_WIDTH_WHITE_SPACE } = require('../../constants');
const { timeConversion, discordTimestamp } = require('../../shared');
const { sentenceListEN, randomCongratulatoryPhrase, bountyEmbed, commandMention, reloadHunterMapSubset, syncRankRoles, fillableTextBar, goalCompletionEmbed, seasonalScoreboardEmbed, overallScoreboardEmbed, refreshReferenceChannelScoreboard, refreshBountyThreadStarterMessage, disabledSelectRow, emojiFromNumber, addCompanyAnnouncementPrefix, textsHaveAutoModInfraction, bountyScheduledEventPayload, validateScheduledEventTimestamps, editBountyModalAndSubmissionOptions, unarchiveAndUnlockThread, butIgnoreInteractionCollectorErrors, butIgnoreMissingPermissionErrors, rewardSummary, consolidateHunterReceipts } = require('../shared');
const { Company, Bounty, Hunter } = require('../../database/models');

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
				interaction.reply({
					content: "Which bounty hunters should be credited with completing the bounty?",
					components: [
						new ActionRowBuilder().addComponents(
							new UserSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
								.setPlaceholder("Select bounty hunters...")
								.setMaxValues(5)
						)
					],
					flags: MessageFlags.Ephemeral,
					withResponse: true
				}).then(response => response.resource.message.awaitMessageComponent({ time: timeConversion(2, "m", "ms"), componentType: ComponentType.UserSelect })).then(async collectedInteraction => {
					const { eligibleTurnInIds, newTurnInIds, bannedTurnInIds } = await logicLayer.bounties.checkTurnInEligibility(bounty, Array.from(collectedInteraction.members.values()), runMode);
					if (newTurnInIds.size < 1) {
						collectedInteraction.reply({ content: `No new turn-ins were able to be recorded. You cannot credit yourself or bots for your own bounties. ${bannedTurnInIds.length ? ' The completer(s) mentioned are currently banned.' : ''}`, flags: MessageFlags.Ephemeral });
						return;
					}

					await logicLayer.bounties.bulkCreateCompletions(bounty.id, bounty.companyId, Array.from(eligibleTurnInIds), null);
					if (!collectedInteraction.channel) return;
					await unarchiveAndUnlockThread(collectedInteraction.channel, "Unarchived to update posting");
					collectedInteraction.channel.send({ content: `${sentenceListEN(Array.from(newTurnInIds.values().map(id => userMention(id))))} ${newTurnInIds.size === 1 ? "has" : "have"} turned in this bounty! ${randomCongratulatoryPhrase()}!` });
					const starterMessage = await collectedInteraction.channel.fetchStarterMessage();
					starterMessage.edit({ embeds: [await bountyEmbed(bounty, collectedInteraction.guild, origin.hunter.getLevel(origin.company.xpCoefficient), false, origin.company, eligibleTurnInIds)] });
					return collectedInteraction.update({
						components: []
					});
				}).catch(butIgnoreInteractionCollectorErrors).finally(() => {
					// If the bounty thread was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
					if (interaction.channel) {
						interaction.deleteReply();
					}
				});
			} break;
			case "revoketurnin": {
				interaction.reply({
					content: "Which bounty hunters should be removed from bounty credit?",
					components: [
						new ActionRowBuilder().addComponents(
							new UserSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}`)
								.setPlaceholder("Select bounty hunters...")
								.setMaxValues(5)
						)
					],
					flags: MessageFlags.Ephemeral,
					withResponse: true
				}).then(response => response.resource.message.awaitMessageComponent({ time: timeConversion(2, "m", "ms"), componentType: ComponentType.UserSelect })).then(async collectedInteraction => {
					const removedIds = collectedInteraction.members.map((_, key) => key);
					await logicLayer.bounties.deleteSelectedBountyCompletions(bountyId, removedIds);
					bountyEmbed(bounty, collectedInteraction.guild, origin.hunter.getLevel(origin.company.xpCoefficient), false, origin.company, await logicLayer.bounties.getHunterIdSet(bountyId))
						.then(async embed => {
							await unarchiveAndUnlockThread(collectedInteraction.channel, "completers removed from bounty");
							interaction.message.edit({ embeds: [embed] })
						});

					collectedInteraction.channel.send({ content: `${sentenceListEN(removedIds.map(id => `<@${id}>`))} ${removedIds.length === 1 ? "has" : "have"} been removed as ${removedIds.length === 1 ? "a completer" : "completers"} of this bounty.` });
					return collectedInteraction.reply({ content: `The listed bounty hunter(s) will no longer recieve credit when this bounty is completed.`, flags: MessageFlags.Ephemeral });
				}).catch(butIgnoreInteractionCollectorErrors).finally(() => {
					// If the bounty thread was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
					if (interaction.channel) {
						interaction.deleteReply();
					}
				});
			} break;
			case "showcase": {
				const nextShowcaseInMS = new Date(origin.hunter.lastShowcaseTimestamp).valueOf() + timeConversion(1, "w", "ms");
				if (runMode === "production" && Date.now() < nextShowcaseInMS) {
					interaction.reply({ content: `You can showcase another bounty in ${discordTimestamp(Math.floor(nextShowcaseInMS / 1000), TimestampStyles.RelativeTime)}.`, flags: MessageFlags.Ephemeral });
					return;
				}

				interaction.reply({
					content: "Which channel should this bounty be showcased in?",
					components: [
						new ActionRowBuilder().addComponents(
							new ChannelSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
								.setPlaceholder("Select channel...")
								.setChannelTypes(ChannelType.GuildText)
						)
					],
					flags: MessageFlags.Ephemeral,
					withResponse: true
				}).then(response => response.resource.message.awaitMessageComponent({ time: timeConversion(2, "m", "ms"), componentType: ComponentType.ChannelSelect })).then(async collectedInteraction => {
					const channel = collectedInteraction.channels.first();
					if (!channel.members.has(collectedInteraction.client.user.id)) {
						collectedInteraction.reply({ content: "BountyBot is not in the selected channel.", flags: MessageFlags.Ephemeral });
						return;
					}

					if (!channel.permissionsFor(collectedInteraction.user.id).has(PermissionFlagsBits.ViewChannel & PermissionFlagsBits.SendMessages)) {
						collectedInteraction.reply({ content: "You must have permission to view and send messages in the selected channel to showcase a bounty in it.", flags: MessageFlags.Ephemeral });
						return;
					}

					await bounty.reload();
					if (bounty.state !== "open") {
						collectedInteraction.reply({ content: "The selected bounty does not seem to be open.", flags: MessageFlags.Ephemeral });
						return;
					}

					bounty.increment("showcaseCount");
					await bounty.reload();
					origin.hunter.update({ lastShowcaseTimestamp: new Date() });
					const hunterIdSet = await logicLayer.bounties.getHunterIdSet(bountyId);
					const currentPosterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
					refreshBountyThreadStarterMessage(collectedInteraction.guild, origin.company, bounty, currentPosterLevel, hunterIdSet);
					return bountyEmbed(bounty, collectedInteraction.guild, currentPosterLevel, false, origin.company, hunterIdSet).then(async embed => {
						await unarchiveAndUnlockThread(channel, "bounty showcased");
						return channel.send({ content: `${collectedInteraction.member} increased the reward on their bounty!`, embeds: [embed] });
					})
				}).catch(butIgnoreInteractionCollectorErrors).finally(() => {
					// If the bounty thread was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
					if (interaction.channel) {
						interaction.deleteReply();
					}
				})
			} break;
			case "complete": {
				// disallow completion within 5 minutes of creating bounty
				if (runMode === "production" && new Date() < new Date(new Date(bounty.createdAt) + timeConversion(5, "m", "ms"))) {
					interaction.reply({ content: `Bounties cannot be completed within 5 minutes of their posting. You can ${commandMention("bounty record-turn-ins")} so you won't forget instead.`, flags: MessageFlags.Ephemeral });
					return;
				}

				// Early-out if no completers
				const completions = await logicLayer.bounties.findBountyCompletions(bounty.id);
				const memberCollection = await interaction.guild.members.fetch({ user: completions.map(reciept => reciept.userId) });
				const validatedHunters = new Map();
				for (const [memberId, member] of memberCollection) {
					if (runMode !== "production" || !member.user.bot) {
						const { hunter: [hunter] } = await logicLayer.hunters.findOrCreateBountyHunter(memberId, interaction.guild.id);
						if (!hunter.isBanned) {
							validatedHunters.set(memberId, hunter);
						}
					}
				}

				if (validatedHunters.size < 1) {
					interaction.reply({ content: `There aren't any eligible bounty hunters to credit with completing this bounty. If you'd like to close your bounty without crediting anyone, use ${commandMention("bounty take-down")}.`, flags: MessageFlags.Ephemeral })
					return;
				}

				interaction.reply({
					content: `Which channel should the bounty's completion be announced in?\n\nPending Turn-Ins: ${sentenceListEN(Array.from(validatedHunters.keys()).map(id => userMention(id)))}`,
					components: [
						new ActionRowBuilder().addComponents(
							new ChannelSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
								.setPlaceholder("Select channel...")
								.setChannelTypes(ChannelType.GuildText)
						)
					],
					flags: MessageFlags.Ephemeral,
					withResponse: true
				}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.ChannelSelect })).then(async collectedInteraction => {
					await collectedInteraction.deferReply({ flags: MessageFlags.SuppressNotifications });
					const season = await logicLayer.seasons.incrementSeasonStat(bounty.companyId, "bountiesCompleted");

					let hunterMap = await logicLayer.hunters.getCompanyHunterMap(collectedInteraction.guild.id);
					const companyReceipt = { guildName: collectedInteraction.guild.name };
					const previousCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
					const hunterReceipts = await logicLayer.bounties.completeBounty(bounty, hunterMap.get(bounty.userId), validatedHunters, season, origin.company);
					hunterMap = await reloadHunterMapSubset(hunterMap, [...validatedHunters.keys(), bounty.userId]);
					const currentCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
					if (previousCompanyLevel < currentCompanyLevel) {
						companyReceipt.levelUp = currentCompanyLevel;
					}
					const goalUpdate = await logicLayer.goals.progressGoal(bounty.companyId, "bounties", hunterMap.get(bounty.userId), season);
					if (goalUpdate.gpContributed > 0) {
						companyReceipt.gpExpression = goalUpdate.gpContributed.toString();
					}
					const descendingRanks = await logicLayer.ranks.findAllRanks(collectedInteraction.guild.id);
					const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
					const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks, await collectedInteraction.guild.roles.fetch());
					syncRankRoles(seasonalHunterReceipts, descendingRanks, collectedInteraction.guild.members);

					await unarchiveAndUnlockThread(collectedInteraction.channel, "bounty complete");
					collectedInteraction.channel.setAppliedTags([origin.company.bountyBoardCompletedTagId]);
					consolidateHunterReceipts(hunterReceipts, seasonalHunterReceipts);
					await collectedInteraction.editReply({ content: rewardSummary("bounty", companyReceipt, hunterReceipts, origin.company.maxSimBounties) });
					bountyEmbed(bounty, collectedInteraction.guild, hunterMap.get(bounty.userId).getLevel(origin.company.xpCoefficient), true, origin.company, new Set(validatedHunters.keys()))
						.then(async embed => {
							if (goalUpdate.gpContributed > 0) {
								const { goalId, requiredGP, currentGP } = await logicLayer.goals.findLatestGoalProgress(interaction.guildId);
								if (goalId !== null) {
									embed.addFields({ name: "Server Goal", value: `${fillableTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
								} else {
									embed.addFields({ name: "Server Goal", value: `${fillableTextBar(15, 15, 15)} Completed!` });
								}
							}
							interaction.message.edit({ embeds: [embed], components: [] });
							collectedInteraction.channel.setArchived(true, "bounty completed");
						})
					const announcementOptions = { content: `${userMention(bounty.userId)}'s bounty, ${interaction.channel}, was completed!` };
					if (goalUpdate.goalCompleted) {
						announcementOptions.embeds = [goalCompletionEmbed(goalUpdate.contributorIds)];
					}
					collectedInteraction.channels.first().send(announcementOptions).catch(butIgnoreMissingPermissionErrors);
					const embeds = [];
					const goalProgress = await logicLayer.goals.findLatestGoalProgress(collectedInteraction.guild.id);
					if (origin.company.scoreboardIsSeasonal) {
						embeds.push(await seasonalScoreboardEmbed(origin.company, collectedInteraction.guild, participationMap, descendingRanks, goalProgress));
					} else {
						embeds.push(await overallScoreboardEmbed(origin.company, collectedInteraction.guild, hunterMap, goalProgress));
					}
					refreshReferenceChannelScoreboard(origin.company, collectedInteraction.guild, embeds);
				}).catch(butIgnoreInteractionCollectorErrors).finally(() => {
					// If the bounty thread was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
					if (interaction.channel) {
						interaction.deleteReply();
					}
				});
			} break;
			case "edit": {
				const { modal, submissionOptions } = await editBountyModalAndSubmissionOptions(bounty, false, interaction.id, interaction.guild);
				interaction.showModal(modal).then(() => interaction.awaitModalSubmit(submissionOptions)).then(async modalSubmission => {
					const title = modalSubmission.fields.getTextInputValue("title");
					const description = modalSubmission.fields.getTextInputValue("description");

					const updatePayload = {};
					const errors = [];
					const autoModInfraction = await textsHaveAutoModInfraction(modalSubmission.channel, modalSubmission.member, [title, description], "edit bounty");
					if (autoModInfraction == null) {
						errors.push(`Could not check if the toast breaks automod rules. ${modalSubmission.client.user} may not have the Manage Server permission required to check the automod rules.`);
					} else if (autoModInfraction) {
						errors.push("The bounty's new title or description would trip this server's AutoMod.");
					} else {
						updatePayload.title = title;
						updatePayload.description = description;
					}

					const imageURL = modalSubmission.fields.getTextInputValue("imageURL");
					if (imageURL) {
						try {
							new URL(imageURL);
							updatePayload.attachmentURL = imageURL;
						} catch (error) {
							errors.push(error.message);
						}
					} else {
						updatePayload.attachmentURL = null;
					}

					const startTimestamp = parseInt(modalSubmission.fields.getTextInputValue("startTimestamp"));
					const endTimestamp = parseInt(modalSubmission.fields.getTextInputValue("endTimestamp"));
					if (startTimestamp || endTimestamp) {
						errors.push(...validateScheduledEventTimestamps(startTimestamp, endTimestamp));
					}

					if (errors.length > 0) {
						interaction.deleteReply();
						modalSubmission.reply({ content: `The following errors were encountered while editing your bounty ${bold(title)}:\n• ${errors.join("\n• ")}`, flags: MessageFlags.Ephemeral });
						return;
					}

					if (startTimestamp && endTimestamp) {
						const eventPayload = bountyScheduledEventPayload(title, modalSubmission.member.displayName, bounty.slotNumber, description, updatePayload.attachmentURL, startTimestamp, endTimestamp);
						if (bounty.scheduledEventId) {
							modalSubmission.guild.scheduledEvents.edit(bounty.scheduledEventId, eventPayload);
						} else {
							const event = await modalSubmission.guild.scheduledEvents.create(eventPayload);
							updatePayload.scheduledEventId = event.id;
						}
					} else if (bounty.scheduledEventId) {
						modalSubmission.guild.scheduledEvents.delete(bounty.scheduledEventId);
						updatePayload.scheduledEventId = null;
					}
					bounty.increment("editCount");
					bounty.update(updatePayload);

					// update bounty board
					const embeds = [await bountyEmbed(bounty, modalSubmission.guild, origin.hunter.getLevel(origin.company.xpCoefficient), false, origin.company, await logicLayer.bounties.getHunterIdSet(bountyId))];
					if (origin.company.bountyBoardId) {
						interaction.guild.channels.fetch(origin.company.bountyBoardId).then(bountyBoard => {
							return bountyBoard.threads.fetch(bounty.postingId);
						}).then(async thread => {
							await unarchiveAndUnlockThread(thread, "Unarchived to update posting");
							thread.edit({ name: bounty.title });
							thread.send({ content: "The bounty was edited.", flags: MessageFlags.SuppressNotifications });
							return thread.fetchStarterMessage();
						}).then(posting => {
							posting.edit({ embeds });
						})
					}

					modalSubmission.reply({ content: `Bounty edited! You can use ${commandMention("bounty showcase")} to let other bounty hunters know about the changes.`, embeds, flags: MessageFlags.Ephemeral });
				});
			} break;
			case "swap": {
				const startingPosterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
				const bountySlotCount = Hunter.getBountySlotCount(startingPosterLevel, origin.company.maxSimBounties);
				if (bountySlotCount < 2) {
					interaction.reply({ content: "You currently only have 1 bounty slot in this server.", flags: MessageFlags.Ephemeral });
					return;
				}

				const openBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guild.id);
				const slotOptions = [];
				for (let i = 1; i <= bountySlotCount; i++) {
					if (i !== bounty.slotNumber) {
						const existingBounty = openBounties.find(checkedBounty => checkedBounty.slotNumber === i);
						slotOptions.push(
							{
								emoji: emojiFromNumber(i),
								label: `Slot ${i}: ${existingBounty?.title ?? "Empty"}`,
								description: `XP Reward: ${Bounty.calculateCompleterReward(startingPosterLevel, i, existingBounty?.showcaseCount ?? 0)}`,
								value: i.toString()
							}
						)
					}
				}
				const channelSelectPlaceholder = "Select a channel to announce the swap in...";
				interaction.reply({
					content: "Swapping this bounty to another slot will change its XP reward.",
					components: [
						new ActionRowBuilder().addComponents(
							new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}destination`)
								.setPlaceholder("Select a slot to swap the bounty to...")
								.setMaxValues(1)
								.setOptions(slotOptions)
						),
						disabledSelectRow(channelSelectPlaceholder)
					],
					flags: MessageFlags.Ephemeral,
					withResponse: true
				}).then(response => {
					const sourceSlot = bounty.slotNumber;
					let destinationSlot;
					const collector = response.resource.message.createMessageComponentCollector({ time: timeConversion(2, "m", "ms"), max: 2 });
					collector.on("collect", async collectedInteraction => {
						const [_, stepId] = collectedInteraction.customId.split(SKIP_INTERACTION_HANDLING)
						if (stepId === "destination") {
							destinationSlot = parseInt(collectedInteraction.values[0]);
							collectedInteraction.update({
								components: [
									disabledSelectRow(`Destination Slot: ${destinationSlot}`),
									new ActionRowBuilder().addComponents(
										new ChannelSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}channel`)
											.setPlaceholder(channelSelectPlaceholder)
											.addChannelTypes(ChannelType.GuildText, ChannelType.AnnouncementThread, ChannelType.PrivateThread, ChannelType.PublicThread)
									)
								]
							})
						} else {
							await bounty.reload();
							if (bounty.state !== "open") {
								collectedInteraction.followUp({ content: "The selected bounty appears to already have been completed.", flags: MessageFlags.Ephemeral });
								return;
							}

							let destinationBounty = await logicLayer.bounties.findBounty({ slotNumber: destinationSlot, userId: origin.user.id, companyId: origin.company.id });
							const posterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);

							bounty = await bounty.update({ slotNumber: destinationSlot });
							refreshBountyThreadStarterMessage(interaction.guild, origin.company, bounty, posterLevel, await logicLayer.bounties.getHunterIdSet(bounty.id));

							if (destinationBounty?.state === "open") {
								destinationBounty = await destinationBounty.update({ slotNumber: sourceSlot });
								refreshBountyThreadStarterMessage(interaction.guild, origin.company, destinationBounty, posterLevel, await logicLayer.bounties.getHunterIdSet(destinationBounty.id));
							}

							const destinationRewardValue = Bounty.calculateCompleterReward(posterLevel, destinationSlot, bounty.showcaseCount);
							interaction.channel.send({ content: `This bounty was swapped to Slot ${destinationSlot} and is now worth ${destinationRewardValue} XP.`, flags: MessageFlags.SuppressNotifications });
							collectedInteraction.channels.first().send(addCompanyAnnouncementPrefix(origin.company, { content: `${interaction.member}'s bounty, ${bold(bounty.title)} is now worth ${destinationRewardValue} XP.` }));
							collectedInteraction.update({ components: [] }).then(() => {
								interaction.deleteReply();
							})
						}
					})
				})
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
					await bounty.reload();
					bounty.state = "deleted";
					bounty.save();
					logicLayer.bounties.deleteBountyCompletions(bountyId);
					bounty.destroy();

					origin.hunter.decrement("xp");
					const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
					await logicLayer.seasons.changeSeasonXP(interaction.user.id, interaction.guildId, season.id, -1);
					const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
					const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(await logicLayer.seasons.getParticipationMap(season.id), descendingRanks, await collectedInteraction.guild.roles.fetch());
					syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);

					return collectedInteraction.reply({ content: "Your bounty has been taken down.", flags: MessageFlags.Ephemeral });
				}).catch(butIgnoreInteractionCollectorErrors).finally(() => {
					interaction.channel.delete("Bounty taken down by poster");
				});
			} break;
		}
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
