const { ActionRowBuilder, StringSelectMenuBuilder, CommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, GuildScheduledEventEntityType } = require("discord.js");
const { Sequelize } = require("sequelize");
const { getNumberEmoji, trimForSelectOptionDescription, timeConversion, textsHaveAutoModInfraction, trimForModalTitle } = require("../../util/textUtil");
const { SKIP_INTERACTION_HANDLING, YEAR_IN_MS, commandIds } = require("../../constants");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[string]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[posterId]) {
	const openBounties = await database.models.Bounty.findAll({ where: { userId: posterId, companyId: interaction.guildId, state: "open" } });
	if (openBounties.length < 1) {
		interaction.reply({ content: "You don't seem to have any open bounties at the moment.", ephemeral: true });
		return;
	}

	interaction.reply({
		content: "You can select one of your open bounties to edit below.\n\nKeep in mind that while you're in charge of adding completers and ending the bounty, the bounty is still subject to server rules and moderation.",
		components: [
			new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
					.setPlaceholder("Select a bounty to edit...")
					.setMaxValues(1)
					.setOptions(openBounties.map(bounty => ({
						emoji: getNumberEmoji(bounty.slotNumber),
						label: bounty.title,
						description: trimForSelectOptionDescription(bounty.description),
						value: bounty.id
					})))
			)
		],
		ephemeral: true,
		fetchReply: true
	}).then(reply => {
		const collector = reply.createMessageComponentCollector({ max: 1 });
		collector.on("collect", async (collectedInteraction) => {
			const [bountyId] = collectedInteraction.values;
			// Verify bounty exists
			const bounty = await database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company });
			if (bounty?.state !== "open") {
				interaction.update({ content: `The selected bounty doesn't seem to be open.`, components: [] });
				return;
			}

			const eventStartComponent = new TextInputBuilder().setCustomId("startTimestamp")
				.setLabel("Event Start (Unix Timestamp)")
				.setRequired(false)
				.setStyle(TextInputStyle.Short)
				.setPlaceholder("Required if making an event with the bounty");
			const eventEndComponent = new TextInputBuilder().setCustomId("endTimestamp")
				.setLabel("Event End (Unix Timestamp)")
				.setRequired(false)
				.setStyle(TextInputStyle.Short)
				.setPlaceholder("Required if making an event with the bounty");

			if (bounty.scheduledEventId) {
				const scheduledEvent = await interaction.guild.scheduledEvents.fetch(bounty.scheduledEventId);
				eventStartComponent.setValue((scheduledEvent.scheduledStartTimestamp / 1000).toString());
				eventEndComponent.setValue((scheduledEvent.scheduledEndTimestamp / 1000).toString());
			}
			collectedInteraction.showModal(
				new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${collectedInteraction.id}`)
					.setTitle(trimForModalTitle(`Edit Bounty: ${bounty.title}`))
					.addComponents(
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("title")
								.setLabel("Title")
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
								.setPlaceholder("Discord markdown allowed...")
								.setValue(bounty.title)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("description")
								.setLabel("Description")
								.setRequired(false)
								.setStyle(TextInputStyle.Paragraph)
								.setPlaceholder("Bounties with clear instructions are easier to complete...")
								.setValue(bounty.description)
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId("imageURL")
								.setLabel("Image URL")
								.setRequired(false)
								.setStyle(TextInputStyle.Short)
								.setValue(bounty.attachmentURL ?? "")
						),
						new ActionRowBuilder().addComponents(
							eventStartComponent
						),
						new ActionRowBuilder().addComponents(
							eventEndComponent
						)
					)
			);
			interaction.awaitModalSubmit({ filter: incoming => incoming.customId === `${SKIP_INTERACTION_HANDLING}${collectedInteraction.id}`, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
				const title = modalSubmission.fields.getTextInputValue("title");
				const description = modalSubmission.fields.getTextInputValue("description");

				const errors = [];
				if (await textsHaveAutoModInfraction(modalSubmission.channel, modalSubmission.member, [title, description], "edit bounty")) {
					errors.push("The bounty's new title or description would trip this server's AutoMod.");
				}

				const imageURL = modalSubmission.fields.getTextInputValue("imageURL");
				if (imageURL) {
					try {
						new URL(imageURL);
					} catch (error) {
						errors.push(error.message);
					}
				}

				const startTimestamp = parseInt(modalSubmission.fields.getTextInputValue("startTimestamp"));
				const endTimestamp = parseInt(modalSubmission.fields.getTextInputValue("endTimestamp"));
				const shouldMakeEvent = startTimestamp && endTimestamp;
				if (startTimestamp || endTimestamp) {
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
					interaction.deleteReply();
					modalSubmission.reply({ content: `The following errors were encountered while editing your bounty **${title}**:\n• ${errors.join("\n• ")}`, ephemeral: true });
					return;
				}

				if (title) {
					bounty.title = title;
				}
				if (description) {
					bounty.description = description;
				}
				if (imageURL) {
					bounty.attachmentURL = imageURL;
				} else if (bounty.attachmentURL) {
					bounty.attachmentURL = null;
				}


				if (shouldMakeEvent) {
					const eventPayload = {
						name: `Bounty: ${title}`,
						description,
						scheduledStartTime: startTimestamp * 1000,
						scheduledEndTime: endTimestamp * 1000,
						privacyLevel: 2,
						entityType: GuildScheduledEventEntityType.External,
						entityMetadata: { location: `${modalSubmission.member.displayName}'s #${bounty.slotNumber} Bounty` }
					};
					if (imageURL) {
						eventPayload.image = imageURL;
					}
					if (bounty.scheduledEventId) {
						modalSubmission.guild.scheduledEvents.edit(bounty.scheduledEventId, eventPayload);
					} else {
						const event = await modalSubmission.guild.scheduledEvents.create(eventPayload);
						bounty.scheduledEventId = event.id;
					}
				} else if (bounty.scheduledEventId) {
					modalSubmission.guild.scheduledEvents.delete(bounty.scheduledEventId);
					bounty.scheduledEventId = null;
				}
				bounty.editCount++;
				bounty.save();

				// update bounty board
				const poster = await database.models.Hunter.findOne({ where: { userId: modalSubmission.user.id, companyId: modalSubmission.guildId } });
				const bountyEmbed = await bounty.asEmbed(modalSubmission.guild, poster.level, bounty.Company.festivalMultiplierString(), false, database);

				bounty.updatePosting(modalSubmission.guild, bounty.Company, database);

				modalSubmission.update({ content: `Bounty edited! You can use </bounty showcase:${commandIds.bounty}> to let other bounty hunters know about the changes.`, embeds: [bountyEmbed], components: [] });
			}).catch(console.error);
		});
	})
};

module.exports = {
	data: {
		name: "edit",
		description: "Edit the title, description, image, or time of one of your bounties"
	},
	executeSubcommand
};
