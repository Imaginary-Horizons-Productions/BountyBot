const { StringSelectMenuBuilder, ActionRowBuilder } = require("discord.js");
const { Item } = require("../classes");
const { timeConversion, commandMention } = require("../util/textUtil");
const { bountiesToSelectOptions } = require("../util/messageComponentUtil");
const { SKIP_INTERACTION_HANDLING } = require("../constants");
const { showcaseBounty } = require("../util/bountyUtil");

const itemName = "Bonus Bounty Showcase";
module.exports = new Item(itemName, "Showcase one of your bounties and increase its reward on a separate cooldown", timeConversion(1, "d", "ms"),
	async (interaction, database) => {
		const openBounties = await database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.user.id, state: "open" } });
		if (openBounties.length < 1) {
			interaction.reply({ content: "You don't have any open bounties on this server to showcase.", ephemeral: true });
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
			ephemeral: true,
			fetchReply: true
		}).then(reply => {
			const collector = reply.createMessageComponentCollector({ max: 1 });
			collector.on("collect", async collectedInteraction => {
				showcaseBounty(collectedInteraction, collectedInteraction.values[0], collectedInteraction.channel, true, database);
			})

			collector.on("end", interactionCollection => {
				interaction.deleteReply();
			})
		})
	}
);
