const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { Sequelize } = require("sequelize");
const { getNumberEmoji, trimForSelectOptionDescription } = require("../../util/textUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const openBounties = await database.models.Bounty.findAll({ where: { userId: interaction.client.user.id, companyId: interaction.guildId, state: "open" } });
	const slotOptions = openBounties.map(bounty => {
		return {
			emoji: getNumberEmoji(bounty.slotNumber),
			label: bounty.title,
			description: trimForSelectOptionDescription(bounty.description),
			value: bounty.id
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
				new StringSelectMenuBuilder().setCustomId("evergreenedit")
					.setPlaceholder("Select a bounty to edit...")
					.setMaxValues(1)
					.setOptions(slotOptions)
			)
		],
		ephemeral: true
	});
};

module.exports = {
	data: {
		name: "edit",
		description: "Change the name, description, or image of an evergreen bounty"
	},
	executeSubcommand
};
