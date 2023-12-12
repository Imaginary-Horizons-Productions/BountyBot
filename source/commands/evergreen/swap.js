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
	const existingBounties = await database.models.Bounty.findAll({ where: { isEvergreen: true, companyId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] });
	if (existingBounties.length < 2) {
		interaction.reply({ content: "There must be at least 2 evergreen bounties for this server to swap.", ephemeral: true });
		return;
	}

	interaction.reply({
		content: "Swapping a bounty to another slot will change the XP reward for that bounty.",
		components: [
			new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder().setCustomId("evergreenswapbounty")
					.setPlaceholder("Select a bounty to swap...")
					.setMaxValues(1)
					.setOptions(existingBounties.map(bounty => ({
						emoji: getNumberEmoji(bounty.slotNumber),
						label: bounty.title,
						description: trimForSelectOptionDescription(bounty.description),
						value: bounty.id
					})))
			)
		],
		ephemeral: true
	});
};

module.exports = {
	data: {
		name: "swap",
		description: "Swap the rewards of two evergreen bounties"
	},
	executeSubcommand
};
