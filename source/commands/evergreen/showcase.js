const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType, DiscordjsErrorCodes } = require("discord.js");
const { Sequelize } = require("sequelize");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");
const { bountiesToSelectOptions } = require("../../util/messageComponentUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const existingBounties = await database.models.Bounty.findAll({ where: { isEvergreen: true, companyId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] });
	if (existingBounties.length < 1) {
		interaction.reply({ content: "This server doesn't have any open evergreen bounties posted.", flags: [MessageFlags.Ephemeral] });
		return;
	}

	interaction.reply({
		content: "Unlike normal bounty showcases, an evergreen showcase does not increase the reward of the showcased bounty and is not rate-limited.",
		components: [
			new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
					.setPlaceholder("Select a bounty to showcase...")
					.setMaxValues(1)
					.setOptions(bountiesToSelectOptions(existingBounties))
			)
		],
		flags: [MessageFlags.Ephemeral],
		withResponse: true
	}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(collectedInteraction => {
		const [bountyId] = collectedInteraction.values;
		database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company }).then(async bounty => {
			if (bounty?.state !== "open") {
				collectedInteraction.reply({ content: "The selected bounty seems to have been deleted.", flags: [MessageFlags.Ephemeral] });
				return;
			}

			bounty.asEmbed(interaction.guild, bounty.Company.level, bounty.Company.festivalMultiplierString(), false, database).then(embed => {
				collectedInteraction.reply({ embeds: [embed] });
			});
		});
	}).catch(error => {
		if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
			console.error(error);
		}
	}).finally(() => {
		interaction.deleteReply();
	})
};

module.exports = {
	data: {
		name: "showcase",
		description: "Show the embed for an evergreen bounty"
	},
	executeSubcommand
};
