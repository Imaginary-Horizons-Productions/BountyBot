const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } = require('discord.js');
const { InteractionWrapper } = require('../classes');
const { SAFE_DELIMITER } = require('../constants');

const customId = "bountypostselect";
module.exports = new InteractionWrapper(customId, 3000,
	/** Recieve remaining bounty configurations from the user */
	(interaction, args) => {
		const slotNumber = interaction.values[0];
		interaction.showModal(
			new ModalBuilder().setCustomId(`bountypostmodal${SAFE_DELIMITER}${slotNumber}${SAFE_DELIMITER}false`)
				.setTitle(`New Bounty (Slot ${slotNumber})`)
				.addComponents(
					new ActionRowBuilder().addComponents(
						new TextInputBuilder().setCustomId("title")
							.setLabel("Title")
							.setStyle(TextInputStyle.Short)
							.setPlaceholder("Discord markdown allowed...")
					),
					new ActionRowBuilder().addComponents(
						new TextInputBuilder().setCustomId("description")
							.setLabel("Description")
							.setStyle(TextInputStyle.Paragraph)
							.setPlaceholder("Bounties with clear instructions are easier to complete...")
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
	}
);
