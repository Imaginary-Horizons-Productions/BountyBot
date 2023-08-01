const { PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');
const { getNumberEmoji } = require('../helpers');
const { SAFE_DELIMITER } = require('../constants');

const customId = "moderation";
const options = [];
const subcommands = [
	{
		name: "take-down",
		description: "Take down another user's bounty",
		optionsInput: [
			{
				type: "User",
				name: "poster",
				description: "The mention of the poster of the bounty",
				required: true
			}
		]
	}
];
module.exports = new CommandWrapper(customId, "BountyBot moderation tools", PermissionFlagsBits.ManageRoles, false, false, 3000, options, subcommands,
	(interaction) => {
		switch (interaction.options.getSubcommand()) {
			case subcommands[0].name: // take-down
				const poster = interaction.options.getUser(subcommands[0].optionsInput[0].name);
				database.models.Bounty.findAll({ where: { userId: poster.id, guildId: interaction.guildId, state: "open" } }).then(openBounties => {
					const slotOptions = openBounties.map(bounty => {
						return {
							emoji: getNumberEmoji(bounty.slotNumber),
							label: bounty.title,
							description: bounty.description,
							value: bounty.slotNumber.toString()
						};
					});

					if (slotOptions.length < 1) {
						interaction.reply({ content: `${poster} doesn't seem to have any open bounties at the moment.`, ephemeral: true });
						return;
					}

					interaction.reply({
						content: "The poster will also lose the XP they gained for posting the removed bounty.",
						components: [
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder().setCustomId(`modtakedown${SAFE_DELIMITER}${poster.id}`)
									.setPlaceholder("Select a bounty to take down...")
									.setMaxValues(1)
									.setOptions(slotOptions)
							)
						],
						ephemeral: true
					});
				});
				break;
		}
	}
);
