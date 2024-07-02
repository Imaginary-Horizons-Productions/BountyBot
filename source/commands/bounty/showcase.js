const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { Sequelize } = require("sequelize");
const { timeConversion } = require("../../util/textUtil");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");
const { bountiesToSelectOptions } = require("../../util/messageComponentUtil");
const { showcaseBounty } = require("../../util/bountyUtil");

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
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
						.setPlaceholder("Select a bounty to showcase...")
						.setMaxValues(1)
						.setOptions(bountiesToSelectOptions(existingBounties))
				)
			],
			ephemeral: true,
			fetchReply: true
		}).then(reply => {
			const collector = reply.createMessageComponentCollector({ max: 1 });
			collector.on("collect", (collectedInteraction) => {
				showcaseBounty(collectedInteraction, collectedInteraction.values[0], interaction.channel, false, database);
			})

			collector.on("end", () => {
				interaction.deleteReply();
			})
		})
	})
};

module.exports = {
	data: {
		name: "showcase",
		description: "Show the embed for one of your existing bounties and increase the reward"
	},
	executeSubcommand
};
