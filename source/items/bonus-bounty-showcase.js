const { StringSelectMenuBuilder, ActionRowBuilder, MessageFlags, ComponentType, DiscordjsErrorCodes, PermissionFlagsBits } = require("discord.js");
const { ItemTemplate } = require("../classes");
const { timeConversion, commandMention } = require("../util/textUtil");
const { bountiesToSelectOptions } = require("../util/messageComponentUtil");
const { SKIP_INTERACTION_HANDLING } = require("../constants");

/** @type {typeof import("../logic")} */
let logicLayer;

const itemName = "Bonus Bounty Showcase";
module.exports = new ItemTemplate(itemName, "Showcase one of your bounties and increase its reward on a separate cooldown", timeConversion(1, "d", "ms"),
	async (interaction) => {
		const openBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guild.id);
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
			if (!collectedInteraction.channel.members.has(collectedInteraction.client.user.id)) {
				collectedInteraction.reply({ content: "BountyBot is not in the selected channel.", flags: [MessageFlags.Ephemeral] });
				return;
			}

			if (!collectedInteraction.channel.permissionsFor(collectedInteraction.user.id).has(PermissionFlagsBits.ViewChannel & PermissionFlagsBits.SendMessages)) {
				collectedInteraction.reply({ content: "You must have permission to view and send messages in the selected channel to showcase a bounty in it.", flags: [MessageFlags.Ephemeral] });
				return;
			}

			const bounty = await openBounties.find(bounty => bounty.id === collectedInteraction.values[0]).reload();
			if (bounty.state !== "open") {
				collectedInteraction.reply({ content: "The selected bounty does not seem to be open.", flags: [MessageFlags.Ephemeral] });
				return;
			}

			bounty.increment("showcaseCount");
			await bounty.reload();
			const poster = await logicLayer.hunters.findOneHunter(collectedInteraction.user.id, collectedInteraction.guildId);
			const company = await logicLayer.companies.findCompanyByPK(collectedInteraction.guild.id);
			const completions = await logicLayer.bounties.findBountyCompletions(collectedInteraction.values[0]);
			bounty.updatePosting(collectedInteraction.guild, company, poster.level, completions);
			return bounty.embed(collectedInteraction.guild, poster.level, false, company, completions).then(async embed => {
				if (collectedInteraction.channel.archived) {
					await collectedInteraction.channel.setArchived(false, "bounty showcased");
				}
				return collectedInteraction.channel.send({ content: `${collectedInteraction.member} increased the reward on their bounty!`, embeds: [embed] });
			})
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
