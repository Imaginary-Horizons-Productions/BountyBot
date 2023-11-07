const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, GuildScheduledEventEntityType } = require('discord.js');
const { SelectWrapper } = require('../classes');
const { YEAR_IN_MS } = require('../constants');
const { database } = require('../../database');
const { timeConversion, checkTextsInAutoMod } = require('../util/textUtil');

const mainId = "bountyedit";
module.exports = new SelectWrapper(mainId, 3000,
	/** Recieve bounty reconfigurations from the user */
	(interaction, args) => {
		const [slotNumber] = interaction.values;
		database.models.Bounty.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
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
				new ModalBuilder().setCustomId(mainId)
					.setTitle(`Editing Bounty (${bounty.title})`)
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
			interaction.awaitModalSubmit({ filter: interaction => interaction.customId === mainId, time: timeConversion(5, "m", "ms") }).then(async modalSubmission => {
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

				const bounty = await database.models.Bounty.findOne({ where: { userId: modalSubmission.user.id, companyId: modalSubmission.guildId, slotNumber, state: "open" } });
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
						entityMetadata: { location: `${modalSubmission.member.displayName}'s #${slotNumber} Bounty` }
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
				const company = await database.models.Company.findByPk(modalSubmission.guildId);
				const poster = await database.models.Hunter.findOne({ where: { userId: modalSubmission.user.id, companyId: modalSubmission.guildId } });
				const bountyEmbed = await bounty.asEmbed(modalSubmission.guild, poster.level, company.eventMultiplierString());

				bounty.updatePosting(modalSubmission.guild, company);

				modalSubmission.update({ content: "Bounty edited!", components: [] });
				modalSubmission.channel.send(company.sendAnnouncement({ content: `${modalSubmission.member} has edited one of their bounties:`, embeds: [bountyEmbed] }));
			}).catch(console.error);
		})
	}
);
