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
	const openBounties = await database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.client.user.id, state: "open" }, order: [["slotNumber", "ASC"]] });
	const bountyOptions = openBounties.map(bounty => {
		return {
			emoji: getNumberEmoji(bounty.slotNumber),
			label: bounty.title,
			description: trimForSelectOptionDescription(bounty.description),
			value: bounty.id
		};
	});

	interaction.reply({
		content: "If you'd like to change the title, description, or image of an evergreen bounty, you can use `/evergreen edit` instead.",
		components: [
			new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder().setCustomId("evergreentakedown")
					.setPlaceholder("Select a bounty to take down...")
					.setMaxValues(1)
					.setOptions(bountyOptions)
			)
		],
		ephemeral: true
	});
};

module.exports = {
	data: {
		name: "take-down",
		description: "Take down one of your bounties without awarding XP (forfeit posting XP)"
	},
	executeSubcommand
};
