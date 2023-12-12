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
	const openBounties = await database.models.Bounty.findAll({ where: { userId: posterId, companyId: interaction.guildId, state: "open" } });
	if (openBounties.length < 1) {
		interaction.reply({ content: "You don't seem to have any open bounties at the moment.", ephemeral: true });
		return;
	}

	interaction.reply({
		content: "You can select one of your open bounties to edit below.\n\nKeep in mind that while you're in charge of adding completers and ending the bounty, the bounty is still subject to server rules and moderation.",
		components: [
			new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder().setCustomId("bountyedit")
					.setPlaceholder("Select a bounty to edit...")
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
};

module.exports = {
	data: {
		name: "edit",
		description: "Edit the title, description, image, or time of one of your bounties"
	},
	executeSubcommand
};
