const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { Sequelize } = require("sequelize");
const { trimForSelectOptionDescription, getNumberEmoji } = require("../../util/textUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[string]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[posterId]) {
	database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: posterId, state: "open" } }).then(openBounties => {
		const bountyOptions = openBounties.map(bounty => {
			return {
				emoji: getNumberEmoji(bounty.slotNumber),
				label: bounty.title,
				description: trimForSelectOptionDescription(bounty.description),
				value: bounty.id
			};
		});

		interaction.reply({
			content: "If you'd like to change the title, description, image, or time of your bounty, you can use `/bounty edit` instead.",
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId("bountytakedown")
						.setPlaceholder("Select a bounty to take down...")
						.setMaxValues(1)
						.setOptions(bountyOptions)
				)
			],
			ephemeral: true
		});
	})
};

module.exports = {
	data: {
		name: "take-down",
		description: "Take down one of your bounties without awarding XP (forfeit posting XP)"
	},
	executeSubcommand
};
