const { PermissionFlagsBits, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');
const { SAFE_DELIMITER } = require('../constants');
const { getNumberEmoji } = require('../helpers');

const customId = "evergreen";
const options = [];
const subcommands = [
	{
		name: "post",
		description: "Post an evergreen bounty, limit 10"
	},
	{
		name: "edit",
		description: "Change the name, description, or image of an evergreen bounty"
	}
];
//TODONOW complete
//TODONOW remove
//TODO swap
//TODO showcase
module.exports = new CommandWrapper(customId, "Evergreen Bounties are not closed after completion; ideal for server-wide objectives", PermissionFlagsBits.ManageChannels, true, false, 3000, options, subcommands,
	(interaction) => {
		switch (interaction.options.getSubcommand()) {
			case subcommands[0].name: // post
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
				break;
			case subcommands[1].name:
				database.models.Bounty.findAll({ where: { userId: interaction.client.user.id, guildId: interaction.guildId, state: "open" } }).then(openBounties => {
					const slotOptions = openBounties.map(bounty => {
						return {
							emoji: getNumberEmoji(bounty.slotNumber),
							label: bounty.title,
							description: bounty.description,
							value: bounty.slotNumber.toString()
						};
					});

					if (slotOptions.length < 1) {
						interaction.reply({ content: "This server doesn't seem to have any open evergreen bounties at the moment.", ephemeral: true });
						return;
					}

					interaction.reply({
						content: "Editing an evergreen bounty will not change previous completions.",
						components: [
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder().setCustomId("evergreeneditselect")
									.setPlaceholder("Select a bounty to edit...")
									.setMaxValues(1)
									.setOptions(slotOptions)
							)
						],
						ephemeral: true
					});
				})
				break;
		}
	}
);
