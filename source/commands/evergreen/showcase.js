const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType, DiscordjsErrorCodes, PermissionFlagsBits } = require("discord.js");
const { Sequelize } = require("sequelize");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");
const { bountiesToSelectOptions } = require("../../util/messageComponentUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer]) {
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
		return database.models.Bounty.findByPk(bountyId).then(async bounty => {
			if (bounty?.state !== "open") {
				return collectedInteraction;
			}

			const [company] = await logicLayer.companies.findOrCreateCompany(collectedInteraction.guildId);
			bounty.embed(interaction.guild, company.level, false, company, []).then(embed => {
				const payload = { embeds: [embed] };
				const extraText = interaction.options.get("extra-text");
				if (extraText) {
					payload.content = extraText.value;
				}
				if (!interaction.memberPermissions?.has(PermissionFlagsBits.MentionEveryone)) {
					payload.allowedMentions = { parse: [] };
				}
				collectedInteraction.channel.send(payload);
			});
			return collectedInteraction;
		});
	}).then(interactionToAcknowledge => {
		return interactionToAcknowledge.update({ components: [] });
	}).catch(error => {
		if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
			console.error(error);
		}
	}).finally(() => {
		// If the hosting channel was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
		if (interaction.channel) {
			interaction.deleteReply();
		}
	})
};

module.exports = {
	data: {
		name: "showcase",
		description: "Show the embed for an evergreen bounty",
		optionsInput: [
			{
				type: "String",
				name: "extra-text",
				description: "Text to show in the showcase message",
				required: false
			}
		]
	},
	executeSubcommand
};
