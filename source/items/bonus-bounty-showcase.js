const { StringSelectMenuBuilder, ActionRowBuilder, MessageFlags, ComponentType, DiscordjsErrorCodes } = require("discord.js");
const { Item } = require("../classes");
const { timeConversion, commandMention } = require("../util/textUtil");
const { bountiesToSelectOptions } = require("../util/messageComponentUtil");
const { SKIP_INTERACTION_HANDLING } = require("../constants");
const { showcaseBounty } = require("../util/bountyUtil");

/** @type {typeof import("../logic")} */
let logicLayer;

const itemName = "Bonus Bounty Showcase";
module.exports = new Item(itemName, "Showcase one of your bounties and increase its reward on a separate cooldown", timeConversion(1, "d", "ms"),
	async (interaction, database) => {
		const openBounties = await database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.user.id, state: "open" } });
		if (openBounties.length < 1) {
			interaction.reply({ content: "You don't have any open bounties on this server to showcase.", flags: [MessageFlags.Ephemeral] });
			return true;
		}

		interaction.reply({
			content: `Showcasing a bounty will repost its embed in this channel and increases the XP awarded to completers. This item has a separate cooldown from ${commandMention("bounty showcase")}.`,
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
						.setPlaceholder("Select a bounty...")
						.setOptions(bountiesToSelectOptions(openBounties))
				)
			],
			flags: [MessageFlags.Ephemeral],
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
			showcaseBounty(collectedInteraction, collectedInteraction.values[0], collectedInteraction.channel, true, database);
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
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
