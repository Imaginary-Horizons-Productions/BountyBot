const { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, ComponentType, DiscordjsErrorCodes, MessageFlags } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { timeConversion } = require('../util/textUtil');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "bbshowcase";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, runMode, [bountyId]) => {
		logicLayer.bounties.findBounty(bountyId).then(async bounty => {
			if (bounty.userId !== interaction.user.id) {
				interaction.reply({ content: "Only the bounty poster can showcase the bounty.", flags: [MessageFlags.Ephemeral] });
				return;
			}

			const poster = await logicLayer.hunters.findOneHunter(interaction.user.id, interaction.guild.id);
			const nextShowcaseInMS = new Date(poster.lastShowcaseTimestamp).valueOf() + timeConversion(1, "w", "ms");
			if (runMode === "production" && Date.now() < nextShowcaseInMS) {
				interaction.reply({ content: `You can showcase another bounty in <t:${Math.floor(nextShowcaseInMS / 1000)}:R>.`, flags: [MessageFlags.Ephemeral] });
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
				flags: [MessageFlags.Ephemeral],
				withResponse: true
			}).then(response => response.resource.message.awaitMessageComponent({ time: timeConversion(2, "m", "ms"), componentType: ComponentType.ChannelSelect })).then(async collectedInteraction => {
				const channel = collectedInteraction.channels.first();
				if (!channel.members.has(collectedInteraction.client.user.id)) {
					collectedInteraction.reply({ content: "BountyBot is not in the selected channel.", flags: [MessageFlags.Ephemeral] });
					return;
				}

				if (!channel.permissionsFor(collectedInteraction.user.id).has(PermissionFlagsBits.ViewChannel & PermissionFlagsBits.SendMessages)) {
					collectedInteraction.reply({ content: "You must have permission to view and send messages in the selected channel to showcase a bounty in it.", flags: [MessageFlags.Ephemeral] });
					return;
				}

				const bounty = await existingBounties.find(bounty => bounty.id === bountyId).reload();
				if (bounty.state !== "open") {
					collectedInteraction.reply({ content: "The selected bounty does not seem to be open.", flags: [MessageFlags.Ephemeral] });
					return;
				}

				bounty.increment("showcaseCount");
				await bounty.reload();
				const poster = await logicLayer.hunters.findOneHunter(collectedInteraction.user.id, collectedInteraction.guildId);
				poster.lastShowcaseTimestamp = new Date();
				poster.save();
				const company = await logicLayer.companies.findCompanyByPK(collectedInteraction.guild.id);
				const completions = await logicLayer.bounties.findBountyCompletions(bountyId);
				bounty.updatePosting(collectedInteraction.guild, company, poster.level, completions);
				return bounty.embed(collectedInteraction.guild, poster.level, false, company, completions).then(async embed => {
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
