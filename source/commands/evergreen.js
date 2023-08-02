const { PermissionFlagsBits, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');
const { SAFE_DELIMITER } = require('../constants');

const customId = "evergreen";
const options = [];
const subcommands = []; //TODONOW make into supercommand, add edit, complete, and remove
module.exports = new CommandWrapper(customId, "Evergreen Bounties are not closed after completion; ideal for server-wide objectives", PermissionFlagsBits.ManageChannels, true, false, 3000, options, subcommands,
	(interaction) => {
		database.models.Bounty.findAll({ where: { userId: interaction.client.user.id, guildId: interaction.guildId, state: "open" } }).then(existingBounties => {
			if (existingBounties.length > 9) {
				interaction.reply({ content: "Each server can only have 10 Evergreen Bounties.", ephemeral: true });
				return;
			}

			const slotNumber = existingBounties.length + 1;
			interaction.showModal(
				new ModalBuilder().setCustomId(`evergreenpost${SAFE_DELIMITER}${slotNumber}`)
					.setTitle("New Evergreen Bounty")
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
						)
					)
			);
		});
	}
);
