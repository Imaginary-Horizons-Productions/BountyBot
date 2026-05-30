const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ComponentType, unorderedList, LabelBuilder, FileUploadBuilder, PermissionFlagsBits } = require("discord.js");
const { EmbedLimits } = require("@sapphire/discord.js-utilities");
const { SubcommandWrapper } = require("../../classes");
const { Bounty, Hunter } = require("../../../database/models");
const { emojiFromNumber, textsHaveAutoModInfraction, commandMention, bountyEmbed, bountyControlPanelSelectRow, addCompanyAnnouncementPrefix, syncRankRoles, validateScheduledEventTimestamps, bountyScheduledEventPayload, butIgnoreInteractionCollectorErrors, refreshReferenceChannelScoreboardSeasonal, refreshReferenceChannelScoreboardOverall, isMissingPermissionError } = require("../../shared");
const { timeConversion } = require("../../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");

module.exports = new SubcommandWrapper("post", "Post your own bounty (+1 XP)",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		const existingBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guildId);
		const occupiedSlots = existingBounties.map(bounty => bounty.slotNumber);
		const currentHunterLevel = theater.hunter.getLevel(theater.company.xpCoefficient);
		const bountySlots = Hunter.getBountySlotCount(currentHunterLevel, theater.company.maxSimBounties);
		const slotOptions = [];
		for (let slotNumber = 1; slotNumber <= bountySlots; slotNumber++) {
			if (!occupiedSlots.includes(slotNumber)) {
				slotOptions.push({
					emoji: emojiFromNumber(slotNumber),
					label: `Slot ${slotNumber}`,
					description: `Reward: ${Bounty.calculateCompleterReward(currentHunterLevel, slotNumber, 0)} XP`,
					value: slotNumber.toString()
				})
			}
		}

		if (slotOptions.length < 1) {
			interaction.reply({ content: "You don't seem to have any open bounty slots at the moment.", flags: MessageFlags.Ephemeral });
			return;
		}

		interaction.reply({
			content: "You can post a bounty for other server members to help out with. Here's some examples:\n\t• __Party Up__ Get bounty hunters to join you for a game session\n\t• __WTB/WTS__ Get the word out that you're looking to trade\n\t• __Achievement Get__ Get help working toward an achievement\n\nTo make a bounty, you'll need:\n\t• a title\n\t• a description\nOptionally, you can also add:\n\t• a url for an image\n\t• a start and end time (to make an event to go with your bounty)\n\nKeep in mind that while you're in charge of adding completers and ending the bounty, the bounty is still subject to server rules and moderation.",
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
						.setPlaceholder("XP awarded depends on slot used...")
						.setOptions(slotOptions)
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
			const [slotNumber] = collectedInteraction.values;
			// Check user actually has slot
			await theater.company.reload();
			await theater.hunter.reload();
			const reloadedBountySlotCount = Hunter.getBountySlotCount(theater.hunter.getLevel(theater.company.xpCoefficient), theater.company.maxSimBounties);
			if (parseInt(slotNumber) > reloadedBountySlotCount) {
				interaction.update({ content: `You haven't unlocked bounty slot ${slotNumber} yet.`, components: [] });
				return;
			}

			// Check slot is not occupied
			const existingBounty = await logicLayer.bounties.findBounty({ userId: interaction.user.id, companyId: interaction.guild.id, slotNumber: parseInt(slotNumber) });
			if (existingBounty) {
				interaction.update({ content: `You already have a bounty in slot ${slotNumber}.`, components: [] });
				return;
			}

			const titleId = "title";
			const descriptionId = "description";
			const startTimestampId = "startTimestamp";
			const endTimestampId = "endTimestamp";
			const imageId = "image";
			const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${collectedInteraction.id}`)
				.setTitle(`New Bounty (Slot ${slotNumber})`)
				.addLabelComponents(
					new LabelBuilder().setLabel("Title")
						.setTextInputComponent(
							new TextInputBuilder().setCustomId(titleId)
								.setStyle(TextInputStyle.Short)
								.setPlaceholder("Most Discord markdown allowed...")
								.setMaxLength(EmbedLimits.MaximumTitleLength)
						),
					new LabelBuilder().setLabel("Description")
						.setDescription("A detailed description of the bounty.")
						.setTextInputComponent(
							new TextInputBuilder().setCustomId(descriptionId)
								.setRequired(false)
								.setStyle(TextInputStyle.Paragraph)
								.setPlaceholder("Get a 1 XP bonus on completion for the following: description, image, timestamps")
						),
					new LabelBuilder().setLabel("Event Start")
						.setDescription("The Unix Timestamp for the start time.")
						.setTextInputComponent(
							new TextInputBuilder().setCustomId(startTimestampId)
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
								.setPlaceholder("Required if making an event with the bounty")
						),
					new LabelBuilder().setLabel("Event End")
						.setDescription("The Unix Timestamp for the end time.")
						.setTextInputComponent(
							new TextInputBuilder().setCustomId(endTimestampId)
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
								.setPlaceholder("Required if making an event with the bounty")
						),
					new LabelBuilder().setLabel("Image")
						.setDescription("A diagram or splash image for the bounty.")
						.setFileUploadComponent(
							new FileUploadBuilder().setCustomId(imageId)
								.setRequired(false)
						)
				);
			collectedInteraction.showModal(modal);

			return collectedInteraction.awaitModalSubmit({ filter: (incoming) => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
				const title = modalSubmission.fields.getTextInputValue(titleId);
				const description = modalSubmission.fields.getTextInputValue(descriptionId);

				const autoModInfraction = await textsHaveAutoModInfraction(modalSubmission.channel, modalSubmission.member, [title, description], "bounty post");
				if (autoModInfraction == null) {
					modalSubmission.reply({ content: `Could not check if the toast breaks automod rules. ${modalSubmission.client.user} may not have the Manage Server permission required to check the automod rules.`, flags: MessageFlags.Ephemeral });
					return;
				} else if (autoModInfraction) {
					modalSubmission.reply({ content: "Your bounty could not be posted because it tripped AutoMod.", flags: MessageFlags.Ephemeral });
					return;
				}

				const rawBounty = {
					userId: modalSubmission.user.id,
					companyId: modalSubmission.guildId,
					slotNumber: parseInt(slotNumber),
					title
				};
				if (description) {
					rawBounty.description = description;
				}
				const errors = [];
				const warnings = [];

				const attachmentFileCollection = modalSubmission.fields.getUploadedFiles(imageId);
				if (attachmentFileCollection) {
					const firstAttachment = attachmentFileCollection.first();
					if (firstAttachment) {
						rawBounty.attachmentURL = firstAttachment.url;
					}
				}

				const startTimestamp = parseInt(modalSubmission.fields.getTextInputValue(startTimestampId));
				const endTimestamp = parseInt(modalSubmission.fields.getTextInputValue(endTimestampId));
				if (startTimestamp || endTimestamp) {
					errors.push(...validateScheduledEventTimestamps(startTimestamp, endTimestamp));
				}

				if (errors.length > 0) {
					modalSubmission.reply({ content: `The following errors were encountered while posting your bounty **${title}**:\n${unorderedList(errors)}`, flags: MessageFlags.Ephemeral });
					return;
				}

				const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(modalSubmission.guild.id);
				await logicLayer.seasons.changeSeasonXP(modalSubmission.user.id, modalSubmission.guildId, season.id, 1);
				theater.hunter.increment({ xp: 1 }).then(async () => {
					const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
					const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
					const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks, await interaction.guild.roles.fetch());
					syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);
					const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
					if (theater.company.scoreboardIsSeasonal) {
						refreshReferenceChannelScoreboardSeasonal(theater.company, interaction.guild, participationMap, descendingRanks, goalProgress);
					} else {
						refreshReferenceChannelScoreboardOverall(theater.company, interaction.guild, await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id), goalProgress);
					}
				});

				let event = null;
				if (startTimestamp && endTimestamp) {
					const eventPayload = bountyScheduledEventPayload(title, modalSubmission.member.displayName, rawBounty.slotNumber, description, rawBounty.attachmentURL, startTimestamp, endTimestamp);
					if (modalSubmission.guild.members.me.permissions.has(PermissionFlagsBits.CreateEvents)) {
						event = await modalSubmission.guild.scheduledEvents.create(eventPayload);
						rawBounty.scheduledEventId = event.id;
					} else {
						warnings.push(`Could not create an Event for this bounty; ${modalSubmission.client.user} is missing permission to create Events.`);
					}
				}

				const bounty = await logicLayer.bounties.createBounty(rawBounty);

				// post in bounty board forum
				await theater.hunter.reload();
				const embeds = [bountyEmbed(bounty, modalSubmission.member, theater.hunter.getLevel(theater.company.xpCoefficient), false, theater.company, new Set(), event)];
				modalSubmission.reply(addCompanyAnnouncementPrefix(theater.company, { content: `${modalSubmission.member} has posted a new bounty:`, embeds })).then(() => {
					if (warnings.length > 0) {
						modalSubmission.followUp({ content: `The following issues were encountered while posting your bounty (your bounty was still posted):\n${unorderedList(warnings)}`, flags: MessageFlags.Ephemeral });
					}
					if (theater.company.bountyBoardId) {
						modalSubmission.guild.channels.fetch(theater.company.bountyBoardId).then(bountyBoard => {
							return bountyBoard.threads.create({
								name: bounty.title,
								message: { embeds, components: bountyControlPanelSelectRow(bounty.id) },
								appliedTags: [theater.company.bountyBoardOpenTagId]
							})
						}).then(posting => {
							bounty.update({ postingId: posting.id });
						});
					} else {
						if (!interaction.member.manageable) {
							interaction.followUp({ content: `Looks like your server doesn't have a bounty board channel. Make one with ${commandMention("create-default bounty-board-forum")}?`, flags: MessageFlags.Ephemeral });
						}
					}
				});
			});
		}).catch(butIgnoreInteractionCollectorErrors).finally(() => {
			// If the hosting channel was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
			if (interaction.channel) {
				interaction.deleteReply();
			}
		})
	}
);
