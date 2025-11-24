const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ComponentType, DiscordjsErrorCodes, unorderedList, LabelBuilder } = require("discord.js");
const { EmbedLimits } = require("@sapphire/discord.js-utilities");
const { SubcommandWrapper } = require("../../classes");
const { Bounty, Hunter } = require("../../../database/models");
const { getNumberEmoji, textsHaveAutoModInfraction, commandMention, buildBountyEmbed, generateBountyCommandSelect, sendAnnouncement, updateScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, syncRankRoles, validateScheduledEventTimestamps, createBountyEventPayload } = require("../../shared");
const { timeConversion } = require("../../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");

module.exports = new SubcommandWrapper("post", "Post your own bounty (+1 XP)",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const existingBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guildId);
		const occupiedSlots = existingBounties.map(bounty => bounty.slotNumber);
		const currentHunterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
		const bountySlots = Hunter.getBountySlotCount(currentHunterLevel, origin.company.maxSimBounties);
		const slotOptions = [];
		for (let slotNumber = 1; slotNumber <= bountySlots; slotNumber++) {
			if (!occupiedSlots.includes(slotNumber)) {
				slotOptions.push({
					emoji: getNumberEmoji(slotNumber),
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
						.setMaxValues(1)
						.setOptions(slotOptions)
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
			const [slotNumber] = collectedInteraction.values;
			// Check user actually has slot
			await origin.company.reload();
			await origin.hunter.reload();
			const reloadedBountySlotCount = Hunter.getBountySlotCount(origin.hunter.getLevel(origin.company.xpCoefficient), origin.company.maxSimBounties);
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

			const modal = new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${collectedInteraction.id}`)
				.setTitle(`New Bounty (Slot ${slotNumber})`)
				.addLabelComponents(
					new LabelBuilder().setLabel("Title")
						.setTextInputComponent(
							new TextInputBuilder().setCustomId("title")
								.setStyle(TextInputStyle.Short)
								.setPlaceholder("Discord markdown allowed...")
								.setMaxLength(EmbedLimits.MaximumTitleLength)
						),
					new LabelBuilder().setLabel("Description")
						.setTextInputComponent(
							new TextInputBuilder().setCustomId("description")
								.setRequired(false)
								.setStyle(TextInputStyle.Paragraph)
								.setPlaceholder("Get a 1 XP bonus on completion for the following: description, image URL, timestamps")
						),
					new LabelBuilder().setLabel("Image URL")
						.setTextInputComponent(
							new TextInputBuilder().setCustomId("imageURL")
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
						),
					new LabelBuilder().setLabel("Event Start (Unix Timestamp)")
						.setTextInputComponent(
							new TextInputBuilder().setCustomId("startTimestamp")
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
								.setPlaceholder("Required if making an event with the bounty")
						),
					new LabelBuilder().setLabel("Event End (Unix Timestamp)")
						.setTextInputComponent(
							new TextInputBuilder().setCustomId("endTimestamp")
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
								.setPlaceholder("Required if making an event with the bounty")
						)
				);
			collectedInteraction.showModal(modal);

			return collectedInteraction.awaitModalSubmit({ filter: (incoming) => incoming.customId === modal.data.custom_id, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
				const title = modalSubmission.fields.getTextInputValue("title");
				const description = modalSubmission.fields.getTextInputValue("description");

				if (await textsHaveAutoModInfraction(modalSubmission.channel, modalSubmission.member, [title, description], "bounty post")) {
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

				const imageURL = modalSubmission.fields.getTextInputValue("imageURL");
				if (imageURL) {
					try {
						new URL(imageURL);
						rawBounty.attachmentURL = imageURL;
					} catch (error) {
						errors.push(error.message);
					}
				}

				const startTimestamp = parseInt(modalSubmission.fields.getTextInputValue("startTimestamp"));
				const endTimestamp = parseInt(modalSubmission.fields.getTextInputValue("endTimestamp"));
				if (startTimestamp || endTimestamp) {
					errors.push(...validateScheduledEventTimestamps(startTimestamp, endTimestamp))
				}

				if (errors.length > 0) {
					modalSubmission.reply({ content: `The following errors were encountered while posting your bounty **${title}**:\n${unorderedList(errors)}`, flags: MessageFlags.Ephemeral });
					return;
				}

				const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(modalSubmission.guild.id);
				logicLayer.seasons.changeSeasonXP(modalSubmission.user.id, modalSubmission.guildId, season.id, 1);
				origin.hunter.increment({ xp: 1 }).then(async () => {
					const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
					const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
					const seasonUpdates = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks);
					syncRankRoles(seasonUpdates, descendingRanks, interaction.guild.members);
					const embeds = [];
					const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
					if (origin.company.scoreboardIsSeasonal) {
						embeds.push(await seasonalScoreboardEmbed(origin.company, interaction.guild, participationMap, descendingRanks, goalProgress));
					} else {
						embeds.push(await overallScoreboardEmbed(origin.company, interaction.guild, await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id), goalProgress));
					}
					updateScoreboard(origin.company, interaction.guild, embeds);
				});

				if (startTimestamp && endTimestamp) {
					const eventPayload = createBountyEventPayload(title, modalSubmission.member.displayName, bounty.slotNumber, description, rawBounty.attachmentURL, startTimestamp, endTimestamp);
					const event = await modalSubmission.guild.scheduledEvents.create(eventPayload);
					rawBounty.scheduledEventId = event.id;
				}

				const bounty = await logicLayer.bounties.createBounty(rawBounty);

				// post in bounty board forum
				await origin.hunter.reload();
				const bountyEmbed = await buildBountyEmbed(bounty, modalSubmission.guild, origin.hunter.getLevel(origin.company.xpCoefficient), false, origin.company, new Set());
				modalSubmission.reply(sendAnnouncement(origin.company, { content: `${modalSubmission.member} has posted a new bounty:`, embeds: [bountyEmbed] })).then(() => {
					if (origin.company.bountyBoardId) {
						modalSubmission.guild.channels.fetch(origin.company.bountyBoardId).then(bountyBoard => {
							return bountyBoard.threads.create({
								name: bounty.title,
								message: { embeds: [bountyEmbed], components: generateBountyCommandSelect(bounty.id) },
								appliedTags: [origin.company.bountyBoardOpenTagId]
							})
						}).then(posting => {
							bounty.postingId = posting.id;
							bounty.save()
						});
					} else {
						if (!interaction.member.manageable) {
							interaction.followUp({ content: `Looks like your server doesn't have a bounty board channel. Make one with ${commandMention("create-default bounty-board-forum")}?`, flags: MessageFlags.Ephemeral });
						}
					}
				});
			});
		}).catch(error => {
			if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
				console.error(error);
			}
		}).finally(() => {
			// If the hosting channel was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
			if (interaction.channel) {
				interaction.deleteReply();
			}
		})
	}
);
