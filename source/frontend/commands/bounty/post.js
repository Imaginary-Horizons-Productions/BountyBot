const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, GuildScheduledEventEntityType, MessageFlags, ComponentType, DiscordjsErrorCodes } = require("discord.js");
const { EmbedLimits } = require("@sapphire/discord.js-utilities");
const { SubcommandWrapper } = require("../../classes");
const { Bounty, Hunter } = require("../../../database/models");
const { getNumberEmoji, textsHaveAutoModInfraction, commandMention, buildBountyEmbed, generateBountyBoardButtons, sendAnnouncement, updateScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, updateSeasonalRanks } = require("../../shared");
const { timeConversion } = require("../../../shared");
const { SKIP_INTERACTION_HANDLING, YEAR_IN_MS } = require("../../../constants");

module.exports = new SubcommandWrapper("post", "Post your own bounty (+1 XP)",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, hunter]) {
		const [company] = await logicLayer.companies.findOrCreateCompany(interaction.guild.id);
		const existingBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guildId);
		const occupiedSlots = existingBounties.map(bounty => bounty.slotNumber);
		const currentHunterLevel = hunter.getLevel(company.xpCoefficient);
		const bountySlots = Hunter.getBountySlotCount(currentHunterLevel, company.maxSimBounties);
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
			await company.reload();
			await hunter.reload();
			const reloadedBountySlotCount = Hunter.getBountySlotCount(hunter.getLevel(company.xpCoefficient), company.maxSimBounties);
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

			collectedInteraction.showModal(
				new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${collectedInteraction.id}`)
					.setTitle(`New Bounty (Slot ${slotNumber})`)
					.addComponents(
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("title")
								.setLabel("Title")
								.setStyle(TextInputStyle.Short)
								.setPlaceholder("Discord markdown allowed...")
								.setMaxLength(EmbedLimits.MaximumTitleLength)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("description")
								.setLabel("Description")
								.setRequired(false)
								.setStyle(TextInputStyle.Paragraph)
								.setPlaceholder("Get a 1 XP bonus on completion for the following: description, image URL, timestamps")
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("imageURL")
								.setLabel("Image URL")
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("startTimestamp")
								.setLabel("Event Start (Unix Timestamp)")
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
								.setPlaceholder("Required if making an event with the bounty")
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("endTimestamp")
								.setLabel("Event End (Unix Timestamp)")
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
								.setPlaceholder("Required if making an event with the bounty")
						)
					)
			);

			return collectedInteraction.awaitModalSubmit({ filter: (incoming) => incoming.customId === `${SKIP_INTERACTION_HANDLING}${collectedInteraction.id}`, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
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
					isEvergreen: false,
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
				const shouldMakeEvent = startTimestamp && endTimestamp;
				if (startTimestamp || endTimestamp) {
					if (!shouldMakeEvent) {
						errors.push("Cannot make event with only start or only end timestamp.")
					}
					if (!startTimestamp) {
						errors.push("Start timestamp must be an integer.");
					} else if (!endTimestamp) {
						errors.push("End timestamp must be an integer.");
					} else {
						if (startTimestamp > endTimestamp) {
							errors.push("End timestamp was before start timestamp.");
						}

						const nowTimestamp = Date.now() / 1000;
						if (nowTimestamp >= startTimestamp) {
							errors.push("Start timestamp must be in the future.");
						}

						if (nowTimestamp >= endTimestamp) {
							errors.push("End timestamp must be in the future.");
						}

						if (startTimestamp >= nowTimestamp + (5 * YEAR_IN_MS)) {
							errors.push("Start timestamp cannot be 5 years in the future or further.");
						}

						if (endTimestamp >= nowTimestamp + (5 * YEAR_IN_MS)) {
							errors.push("End timestamp cannot be 5 years in the future or further.");
						}
					}
				}

				if (errors.length > 0) {
					modalSubmission.reply({ content: `The following errors were encountered while posting your bounty **${title}**:\n• ${errors.join("\n• ")}`, flags: MessageFlags.Ephemeral });
					return;
				}

				const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(modalSubmission.guild.id);
				logicLayer.seasons.changeSeasonXP(modalSubmission.user.id, modalSubmission.guildId, season.id, 1);
				const company = await logicLayer.companies.findCompanyByPK(modalSubmission.guild.id);
				const poster = await logicLayer.hunters.findOneHunter(modalSubmission.user.id, modalSubmission.guildId);
				poster.increment({ xp: 1 }).then(async () => {
					const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
					const seasonUpdates = await logicLayer.seasons.updateCompanyPlacementsAndRanks(season, await logicLayer.seasons.getCompanyParticipationMap(season.id), descendingRanks);
					updateSeasonalRanks(seasonUpdates, descendingRanks, interaction.guild.members);
					const embeds = [];
					const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
					if (company.scoreboardIsSeasonal) {
						embeds.push(await seasonalScoreboardEmbed(company, interaction.guild, await logicLayer.seasons.findSeasonParticipations(season.id), descendingRanks, goalProgress));
					} else {
						embeds.push(await overallScoreboardEmbed(company, interaction.guild, await logicLayer.hunters.findCompanyHunters(interaction.guild.id), descendingRanks, goalProgress));
					}
					updateScoreboard(company, interaction.guild, embeds);
				});

				if (shouldMakeEvent) {
					const eventPayload = {
						name: `Bounty: ${title}`,
						scheduledStartTime: startTimestamp * 1000,
						scheduledEndTime: endTimestamp * 1000,
						privacyLevel: 2,
						entityType: GuildScheduledEventEntityType.External,
						entityMetadata: { location: `${modalSubmission.member.displayName}'s #${slotNumber} Bounty` }
					};
					if (description) {
						eventPayload.description = description;
					}
					if (imageURL) {
						eventPayload.image = imageURL;
					}
					const event = await modalSubmission.guild.scheduledEvents.create(eventPayload);
					rawBounty.scheduledEventId = event.id;
				}

				const bounty = await logicLayer.bounties.createBounty(rawBounty);

				// post in bounty board forum
				await poster.reload();
				const bountyEmbed = await buildBountyEmbed(bounty, modalSubmission.guild, poster.getLevel(company.xpCoefficient), false, company, []);
				modalSubmission.reply(sendAnnouncement(company, { content: `${modalSubmission.member} has posted a new bounty:`, embeds: [bountyEmbed] })).then(() => {
					if (company.bountyBoardId) {
						modalSubmission.guild.channels.fetch(company.bountyBoardId).then(bountyBoard => {
							return bountyBoard.threads.create({
								name: bounty.title,
								message: { embeds: [bountyEmbed], components: generateBountyBoardButtons(bounty) },
								appliedTags: [company.bountyBoardOpenTagId]
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
