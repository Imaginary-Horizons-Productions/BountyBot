const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } = require('discord.js');
const { InteractionWrapper } = require('../classes');
const { SAFE_DELIMITER } = require('../constants');
const { database } = require('../../database');

const customId = "evergreeneditselect";
module.exports = new InteractionWrapper(customId, 3000,
	/** Recieve bounty reconfigurations from the user */
	(interaction, args) => {
		const [slotNumber] = interaction.values;
		database.models.Bounty.findOne({ where: { userId: interaction.client.user.id, guildId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
			interaction.showModal(
				new ModalBuilder().setCustomId(`evergreeneditmodal${SAFE_DELIMITER}${slotNumber}`)
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
						)
					)
			);
		})
	}
);
