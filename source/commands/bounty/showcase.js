const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { Sequelize } = require("sequelize");
const { getNumberEmoji, trimForSelectOptionDescription, timeConversion } = require("../../util/textUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[string]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[posterId]) {
	database.models.Hunter.findOne({ where: { userId: posterId, companyId: interaction.guildId } }).then(async hunter => {
		const nextShowcaseInMS = new Date(hunter.lastShowcaseTimestamp).valueOf() + timeConversion(1, "w", "ms");
		if (Date.now() < nextShowcaseInMS) {
			interaction.reply({ content: `You can showcase another bounty in <t:${Math.floor(nextShowcaseInMS / 1000)}:R>.`, ephemeral: true });
			return;
		}

		const existingBounties = await database.models.Bounty.findAll({ where: { userId: posterId, companyId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] });
		if (existingBounties.length < 1) {
			interaction.reply({ content: "You doesn't have any open bounties posted.", ephemeral: true });
			return;
		}

		interaction.reply({
			content: "You can showcase 1 bounty per week. The showcased bounty's XP reward will be increased.",
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId("bountyshowcase")
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
	})
};

module.exports = {
	data: {
		name: "showcase",
		description: "Show the embed for one of your existing bounties and increase the reward"
	},
	executeSubcommand
};
