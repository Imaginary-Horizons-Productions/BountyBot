const { StringSelectMenuBuilder, ActionRowBuilder, MessageFlags, ComponentType, DiscordjsErrorCodes, PermissionFlagsBits } = require("discord.js");
const { ItemTemplate, ItemTemplateSet } = require("../classes");
const { timeConversion } = require("../../shared");
const { commandMention, bountiesToSelectOptions, buildBountyEmbed, updatePosting } = require("../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");

/** @type {typeof import("../../logic")} */
let logicLayer;

const itemName = "Bonus Bounty Showcase";
module.exports = new ItemTemplateSet(
	new ItemTemplate(itemName, "Showcase one of your bounties and increase its reward on a separate cooldown", timeConversion(1, "d", "ms"),
		async (interaction, origin) => {
			const openBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guild.id);
			if (openBounties.length < 1) {
				interaction.reply({ content: "You don't have any open bounties on this server to showcase.", flags: MessageFlags.Ephemeral });
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
				flags: MessageFlags.Ephemeral,
				withResponse: true
			}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
				if (!collectedInteraction.channel.members.has(collectedInteraction.client.user.id)) {
					collectedInteraction.reply({ content: "BountyBot is not in the selected channel.", flags: MessageFlags.Ephemeral });
					return;
				}

				if (!collectedInteraction.channel.permissionsFor(collectedInteraction.user.id).has(PermissionFlagsBits.ViewChannel & PermissionFlagsBits.SendMessages)) {
					collectedInteraction.reply({ content: "You must have permission to view and send messages in the selected channel to showcase a bounty in it.", flags: MessageFlags.Ephemeral });
					return;
				}

				const bounty = await openBounties.find(bounty => bounty.id === collectedInteraction.values[0]).reload();
				if (bounty.state !== "open") {
					collectedInteraction.reply({ content: "The selected bounty does not seem to be open.", flags: MessageFlags.Ephemeral });
					return;
				}

				bounty.increment("showcaseCount");
				await bounty.reload();
				const hunterIdSet = await logicLayer.bounties.getHunterIdSet(collectedInteraction.values[0]);
				const currentPosterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
				updatePosting(collectedInteraction.guild, origin.company, bounty, currentPosterLevel, hunterIdSet);
				return buildBountyEmbed(bounty, collectedInteraction.guild, currentPosterLevel, false, origin.company, hunterIdSet).then(async embed => {
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
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
