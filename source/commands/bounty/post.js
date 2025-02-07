const { ActionRowBuilder, StringSelectMenuBuilder, CommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, GuildScheduledEventEntityType, ButtonBuilder, ButtonStyle, MessageFlags, ComponentType, DiscordjsErrorCodes } = require("discord.js");
const { Sequelize } = require("sequelize");
const { Bounty } = require("../../models/bounties/Bounty");
const { Hunter } = require("../../models/users/Hunter");
const { getNumberEmoji, timeConversion, textsHaveAutoModInfraction, commandMention } = require("../../util/textUtil");
const { SKIP_INTERACTION_HANDLING, MAX_EMBED_TITLE_LENGTH, YEAR_IN_MS, SAFE_DELIMITER } = require("../../constants");
const { updateScoreboard } = require("../../util/embedUtil");
const { getRankUpdates } = require("../../util/scoreUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[string, Hunter]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[posterId, hunter]) {
	const [{ maxSimBounties }] = await database.models.Company.findOrCreate({ where: { id: interaction.guildId } });
	const existingBounties = await database.models.Bounty.findAll({ where: { userId: posterId, companyId: interaction.guildId, state: "open" } });
	const occupiedSlots = existingBounties.map(bounty => bounty.slotNumber);
	const bountySlots = hunter.maxSlots(maxSimBounties);
	const slotOptions = [];
	for (let slotNumber = 1; slotNumber <= bountySlots; slotNumber++) {
		if (!occupiedSlots.includes(slotNumber)) {
			slotOptions.push({
				emoji: getNumberEmoji(slotNumber),
				label: `Slot ${slotNumber}`,
				description: `Reward: ${Bounty.calculateCompleterReward(hunter.level, slotNumber, 0)} XP`,
				value: slotNumber.toString()
			})
		}
	}

	if (slotOptions.length < 1) {
		interaction.reply({ content: "You don't seem to have any open bounty slots at the moment.", flags: [MessageFlags.Ephemeral] });
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
		flags: [MessageFlags.Ephemeral],
		withResponse: true
	}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
		const [slotNumber] = collectedInteraction.values;
		// Check user actually has slot
		const company = await database.models.Company.findByPk(interaction.guildId);
		const hunter = await database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId: interaction.user.id } });
		if (parseInt(slotNumber) > hunter.maxSlots(company.maxSimBounties)) {
			interaction.update({ content: `You haven't unlocked bounty slot ${slotNumber} yet.`, components: [] });
			return;
		}

		// Check slot is not occupied
		const existingBounty = await database.models.Bounty.findOne({ where: { state: "open", userId: interaction.user.id, companyId: interaction.guildId, slotNumber: parseInt(slotNumber) } });
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
							.setMaxLength(MAX_EMBED_TITLE_LENGTH)
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

		collectedInteraction.awaitModalSubmit({ filter: (incoming) => incoming.customId === `${SKIP_INTERACTION_HANDLING}${collectedInteraction.id}`, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
			const title = modalSubmission.fields.getTextInputValue("title");
			const description = modalSubmission.fields.getTextInputValue("description");

			if (await textsHaveAutoModInfraction(modalSubmission.channel, modalSubmission.member, [title, description], "bounty post")) {
				modalSubmission.reply({ content: "Your bounty could not be posted because it tripped AutoMod.", flags: [MessageFlags.Ephemeral] });
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
				modalSubmission.reply({ content: `The following errors were encountered while posting your bounty **${title}**:\n• ${errors.join("\n• ")}`, flags: [MessageFlags.Ephemeral] });
				return;
			}

			const [season] = await database.models.Season.findOrCreate({ where: { companyId: modalSubmission.guildId, isCurrentSeason: true } });
			const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { companyId: modalSubmission.guildId, userId: modalSubmission.user.id, seasonId: season.id }, defaults: { xp: 1 } });
			if (!participationCreated) {
				participation.increment({ xp: 1 });
			}
			const company = await database.models.Company.findByPk(modalSubmission.guildId);
			const poster = await database.models.Hunter.findOne({ where: { userId: modalSubmission.user.id, companyId: modalSubmission.guildId } });
			poster.addXP(modalSubmission.guild.name, 1, true, database).then(() => {
				getRankUpdates(modalSubmission.guild, database);
				updateScoreboard(company, interaction.guild, database);
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

			const bounty = await database.models.Bounty.create(rawBounty);

			// post in bounty board forum
			const bountyEmbed = await bounty.embed(modalSubmission.guild, poster.level, false, company, await database.models.Completion.findAll({ where: { bountyId: bounty.id } }));
			modalSubmission.reply(company.sendAnnouncement({ content: `${modalSubmission.member} has posted a new bounty:`, embeds: [bountyEmbed] })).then(() => {
				if (company.bountyBoardId) {
					modalSubmission.guild.channels.fetch(company.bountyBoardId).then(bountyBoard => {
						return bountyBoard.threads.create({
							name: bounty.title,
							message: {
								embeds: [bountyEmbed],
								components: [new ActionRowBuilder().addComponents(
									new ButtonBuilder().setCustomId(`bbcomplete${SAFE_DELIMITER}${bounty.id}`)
										.setStyle(ButtonStyle.Success)
										.setLabel("Complete")
										.setDisabled(true),
									new ButtonBuilder().setCustomId(`bbaddcompleters${SAFE_DELIMITER}${bounty.id}`)
										.setStyle(ButtonStyle.Primary)
										.setLabel("Credit Hunters"),
									new ButtonBuilder().setCustomId(`bbremovecompleters${SAFE_DELIMITER}${bounty.id}`)
										.setStyle(ButtonStyle.Secondary)
										.setLabel("Uncredit Hunters"),
									new ButtonBuilder().setCustomId(`bbshowcase${SAFE_DELIMITER}${bounty.id}`)
										.setStyle(ButtonStyle.Primary)
										.setLabel("Showcase this Bounty"),
									new ButtonBuilder().setCustomId(`bbtakedown${SAFE_DELIMITER}${bounty.id}`)
										.setStyle(ButtonStyle.Danger)
										.setLabel("Take Down")
								)]
							},
							appliedTags: [company.bountyBoardOpenTagId]
						})
					}).then(posting => {
						bounty.postingId = posting.id;
						bounty.save()
					});
				} else {
					interaction.followUp({ content: `Looks like your server doesn't have a bounty board channel. Make one with ${commandMention("create-default bounty-board-forum")}?`, flags: [MessageFlags.Ephemeral] });
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
};

module.exports = {
	data: {
		name: "post",
		description: "Post your own bounty (+1 XP)"
	},
	executeSubcommand
};
