const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { Sequelize } = require("sequelize");
const { getNumberEmoji, trimForSelectOptionDescription } = require("../../util/textUtil");
const { SAFE_DELIMITER } = require("../../constants");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const poster = interaction.options.getUser("poster");
	const openBounties = await database.models.Bounty.findAll({ where: { userId: poster.id, companyId: interaction.guildId, state: "open" } });
	const slotOptions = openBounties.map(bounty => {
		return {
			emoji: getNumberEmoji(bounty.slotNumber),
			label: bounty.title,
			description: trimForSelectOptionDescription(bounty.description),
			value: bounty.id
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
};

module.exports = {
	data: {
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
	},
	executeSubcommand
};
