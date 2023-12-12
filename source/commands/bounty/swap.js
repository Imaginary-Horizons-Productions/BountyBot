const { ActionRowBuilder, StringSelectMenuBuilder, CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");
const { getNumberEmoji, trimForSelectOptionDescription } = require("../../util/textUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[string]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[posterId]) {
	database.models.Bounty.findAll({ where: { userId: posterId, companyId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] }).then(openBounties => {
		if (openBounties.length < 1) {
			interaction.reply({ content: "You don't seem to have any open bounties at the moment.", ephemeral: true });
			return;
		}

		interaction.reply({
			content: "Swapping a bounty to another slot will change the XP reward for that bounty.",
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId("bountyswapbounty")
						.setPlaceholder("Select a bounty to swap...")
						.setMaxValues(1)
						.setOptions(openBounties.map(bounty => ({
							emoji: getNumberEmoji(bounty.slotNumber),
							label: bounty.title,
							description: trimForSelectOptionDescription(bounty.description),
							value: bounty.id
						})))
				)
			],
			ephemeral: true
		});
	})
};

module.exports = {
	data: {
		name: "swap",
		description: "Move one of your bounties to another slot to change its reward"
	},
	executeSubcommand
};
