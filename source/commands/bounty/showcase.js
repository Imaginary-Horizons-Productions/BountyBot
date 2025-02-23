const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType, DiscordjsErrorCodes } = require("discord.js");
const { Sequelize } = require("sequelize");
const { timeConversion } = require("../../util/textUtil");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");
const { bountiesToSelectOptions } = require("../../util/messageComponentUtil");
const { showcaseBounty } = require("../../util/bountyUtil");

/** @type {typeof import("../../logic")} */
let logicLayer;

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[string]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[posterId]) {
	logicLayer.hunters.findOneHunter(posterId, interaction.guild.id).then(async hunter => {
		const nextShowcaseInMS = new Date(hunter.lastShowcaseTimestamp).valueOf() + timeConversion(1, "w", "ms");
		if (runMode === "prod" && Date.now() < nextShowcaseInMS) {
			interaction.reply({ content: `You can showcase another bounty in <t:${Math.floor(nextShowcaseInMS / 1000)}:R>.`, flags: [MessageFlags.Ephemeral] });
			return;
		}

		const existingBounties = await database.models.Bounty.findAll({ where: { userId: posterId, companyId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] });
		if (existingBounties.length < 1) {
			interaction.reply({ content: "You doesn't have any open bounties posted.", flags: [MessageFlags.Ephemeral] });
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
			flags: [MessageFlags.Ephemeral],
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(collectedInteraction => {
			showcaseBounty(collectedInteraction, collectedInteraction.values[0], interaction.channel, false, database);
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
	})
};

module.exports = {
	data: {
		name: "showcase",
		description: "Show the embed for one of your existing bounties and increase the reward"
	},
	executeSubcommand,
	setLogic: (logicBlob) => {
		logicLayer = logicBlob;
	}
};
