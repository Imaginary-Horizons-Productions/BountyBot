const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { Sequelize } = require("sequelize");
const { getNumberEmoji, trimForSelectOptionDescription } = require("../../util/textUtil");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");

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
				new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
					.setPlaceholder("Select a bounty to showcase...")
					.setMaxValues(1)
					.setOptions(existingBounties.map(bounty => {
						const optionPayload = {
							emoji: getNumberEmoji(bounty.slotNumber),
							label: bounty.title,
							value: bounty.id
						};
						if (bounty.description !== null) {
							optionPayload.description = trimForSelectOptionDescription(bounty.description);
						}
						return optionPayload;
					}))
			)
		],
		ephemeral: true,
		fetchReply: true
	}).then(reply => {
		const collector = reply.createMessageComponentCollector({ max: 1 });
		collector.on("collect", (collectedInteraction) => {
			const [bountyId] = collectedInteraction.values;
			database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company }).then(async bounty => {
				if (bounty?.state !== "open") {
					collectedInteraction.reply({ content: "The selected bounty seems to have been deleted.", ephemeral: true });
					return;
				}

				bounty.asEmbed(interaction.guild, bounty.Company.level, bounty.Company.festivalMultiplierString(), false, database).then(embed => {
					collectedInteraction.reply({ embeds: [embed] });
				});
			});
		})

		collector.on("end", () => {
			interaction.deleteReply();
		})
	})
};

module.exports = {
	data: {
		name: "showcase",
		description: "Show the embed for an evergreen bounty"
	},
	executeSubcommand
};
