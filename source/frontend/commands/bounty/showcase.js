const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType, PermissionFlagsBits, TimestampStyles } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { timeConversion, discordTimestamp, butIgnoreDiscordInteractionCollectorErrors } = require("../../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { bountiesToSelectOptions, buildBountyEmbed, updatePosting } = require("../../shared");

module.exports = new SubcommandWrapper("showcase", "Show the embed for one of your existing bounties and increase the reward",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const nextShowcaseInMS = new Date(origin.hunter.lastShowcaseTimestamp).valueOf() + timeConversion(1, "w", "ms");
		if (runMode === "production" && Date.now() < nextShowcaseInMS) {
			interaction.reply({ content: `You can showcase another bounty in ${discordTimestamp(Math.floor(nextShowcaseInMS / 1000), TimestampStyles.RelativeTime)}.`, flags: MessageFlags.Ephemeral });
			return;
		}

		const existingBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guildId);
		if (existingBounties.length < 1) {
			interaction.reply({ content: "You doesn't have any open bounties posted.", flags: MessageFlags.Ephemeral });
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
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
			if (!interaction.channel.members.has(collectedInteraction.client.user.id)) {
				collectedInteraction.reply({ content: "BountyBot is not in the selected channel.", flags: MessageFlags.Ephemeral });
				return;
			}

			if (!interaction.channel.permissionsFor(collectedInteraction.user.id).has(PermissionFlagsBits.ViewChannel & PermissionFlagsBits.SendMessages)) {
				collectedInteraction.reply({ content: "You must have permission to view and send messages in the selected channel to showcase a bounty in it.", flags: MessageFlags.Ephemeral });
				return;
			}

			const bounty = await existingBounties.find(bounty => bounty.id === collectedInteraction.values[0]).reload();
			if (bounty.state !== "open") {
				collectedInteraction.reply({ content: "The selected bounty does not seem to be open.", flags: MessageFlags.Ephemeral });
				return;
			}

			bounty.increment("showcaseCount");
			await bounty.reload();
			origin.hunter.lastShowcaseTimestamp = new Date();
			origin.hunter.save();
			const hunterIdSet = await logicLayer.bounties.getHunterIdSet(collectedInteraction.values[0]);
			const currentPosterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
			updatePosting(collectedInteraction.guild, origin.company, bounty, currentPosterLevel, hunterIdSet);
			return buildBountyEmbed(bounty, collectedInteraction.guild, currentPosterLevel, false, origin.company, hunterIdSet).then(async embed => {
				if (interaction.channel.archived) {
					await interaction.channel.setArchived(false, "bounty showcased");
				}
				return interaction.channel.send({ content: `${collectedInteraction.member} increased the reward on their bounty!`, embeds: [embed] });
			})
		}).catch(butIgnoreDiscordInteractionCollectorErrors).finally(() => {
			// If the hosting channel was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
			if (interaction.channel) {
				interaction.deleteReply();
			}
		})
	}
);
