const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } = require('discord.js');
const { InteractionWrapper } = require('../classes');
const { SAFE_DELIMITER } = require('../constants');
const { database } = require('../../database');

const customId = "bountyeditselect";
module.exports = new InteractionWrapper(customId, 3000,
	/** Recieve bounty reconfigurations from the user */
	(interaction, args) => {
		const slotNumber = interaction.values[0];
		database.models.Bounty.findOne({ where: { userId: interaction.user.id, guildId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
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
				new ModalBuilder().setCustomId(`bountyeditmodal${SAFE_DELIMITER}${slotNumber}`)
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
		})
	}
);
