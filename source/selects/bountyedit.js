const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, GuildScheduledEventEntityType } = require('discord.js');
const { SelectWrapper } = require('../classes');
const { YEAR_IN_MS, SKIP_INTERACTION_HANDLING } = require('../constants');
const { timeConversion, checkTextsInAutoMod, trimForModalTitle } = require('../util/textUtil');

const mainId = "bountyedit";
module.exports = new SelectWrapper(mainId, 3000,
	/** Recieve bounty reconfigurations from the user */
	async (interaction, args, database) => {
		const [bountyId] = interaction.values;
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
		interaction.showModal(
			new ModalBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
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
		interaction.awaitModalSubmit({ filter: incoming => incoming.customId === `${SKIP_INTERACTION_HANDLING}${interaction.id}`, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
			const title = modalSubmission.fields.getTextInputValue("title");
			const description = modalSubmission.fields.getTextInputValue("description");

			const isBlockedByAutoMod = await checkTextsInAutoMod(modalSubmission.channel, modalSubmission.member, [title, description], "edit bounty");
			if (isBlockedByAutoMod) {
				modalSubmission.reply({ content: "Your edit could not be completed because it tripped AutoMod.", ephemeral: true });
				return;
			}

			const errors = [];

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
				modalSubmission.message.edit({ components: [] });
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

			modalSubmission.update({ content: "Bounty edited! If you'd like to let other hunters know about the changes, you can use `/bounty showcase`.", embeds: [bountyEmbed], components: [] });
		}).catch(console.error);
	}
);
