const { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, ComponentType, DiscordjsErrorCodes, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../../constants');
const { timeConversion } = require('../../shared');
const { buildBountyEmbed, updatePosting } = require('../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "bbshowcase";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, origin, runMode, [bountyId]) => {
		logicLayer.bounties.findBounty(bountyId).then(async bounty => {
			if (bounty.userId !== interaction.user.id) {
				interaction.reply({ content: "Only the bounty poster can showcase the bounty.", flags: MessageFlags.Ephemeral });
				return;
			}

			const nextShowcaseInMS = new Date(origin.hunter.lastShowcaseTimestamp).valueOf() + timeConversion(1, "w", "ms");
			if (runMode === "production" && Date.now() < nextShowcaseInMS) {
				interaction.reply({ content: `You can showcase another bounty in <t:${Math.floor(nextShowcaseInMS / 1000)}:R>.`, flags: MessageFlags.Ephemeral });
				return;
			}

			interaction.reply({
				content: "Which channel should this bounty be showcased in?",
				components: [
					new ActionRowBuilder().addComponents(
						new ChannelSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
							.setPlaceholder("Select channel...")
							.setChannelTypes(ChannelType.GuildText)
					)
				],
				flags: MessageFlags.Ephemeral,
				withResponse: true
			}).then(response => response.resource.message.awaitMessageComponent({ time: timeConversion(2, "m", "ms"), componentType: ComponentType.ChannelSelect })).then(async collectedInteraction => {
				const channel = collectedInteraction.channels.first();
				if (!channel.members.has(collectedInteraction.client.user.id)) {
					collectedInteraction.reply({ content: "BountyBot is not in the selected channel.", flags: MessageFlags.Ephemeral });
					return;
				}

				if (!channel.permissionsFor(collectedInteraction.user.id).has(PermissionFlagsBits.ViewChannel & PermissionFlagsBits.SendMessages)) {
					collectedInteraction.reply({ content: "You must have permission to view and send messages in the selected channel to showcase a bounty in it.", flags: MessageFlags.Ephemeral });
					return;
				}

				await bounty.reload();
				if (bounty.state !== "open") {
					collectedInteraction.reply({ content: "The selected bounty does not seem to be open.", flags: MessageFlags.Ephemeral });
					return;
				}

				bounty.increment("showcaseCount");
				await bounty.reload();
				origin.hunter.lastShowcaseTimestamp = new Date();
				origin.hunter.save();
				const hunterIdSet = await logicLayer.bounties.getHunterIdSet(bountyId);
				const currentPosterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
				updatePosting(collectedInteraction.guild, origin.company, bounty, currentPosterLevel, hunterIdSet);
				return buildBountyEmbed(bounty, collectedInteraction.guild, currentPosterLevel, false, origin.company, hunterIdSet).then(async embed => {
					if (channel.archived) {
						await channel.setArchived(false, "bounty showcased");
					}
					return channel.send({ content: `${collectedInteraction.member} increased the reward on their bounty!`, embeds: [embed] });
				})
			}).catch(error => {
				if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
					console.error(error);
				}
			}).finally(() => {
				// If the bounty thread was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
				if (interaction.channel) {
					interaction.deleteReply();
				}
			})
		})
	}
).setLogicLinker(logicBundle => {
	logicLayer = logicBundle;
});
