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
	if (existingBounties.length < 1) {
		interaction.reply({ content: "This server doesn't have any open evergreen bounties posted.", ephemeral: true });
		return;
	}

	interaction.reply({
		content: "Unlike normal bounty showcases, an evergreen showcase does not increase the reward of the showcased bounty and is not rate-limited.",
		components: [
			new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder().setCustomId("evergreenshowcase")
					.setPlaceholder("Select a bounty to showcase...")
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
		name: "showcase",
		description: "Show the embed for an evergreen bounty"
	},
	executeSubcommand
};
