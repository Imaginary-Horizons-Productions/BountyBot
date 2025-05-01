const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType, DiscordjsErrorCodes, PermissionFlagsBits } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { timeConversion } = require("../../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { bountiesToSelectOptions, buildBountyEmbed, updatePosting } = require("../../shared");

module.exports = new SubcommandWrapper("showcase", "Show the embed for one of your existing bounties and increase the reward",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, posterId]) {
		logicLayer.hunters.findOneHunter(posterId, interaction.guild.id).then(async hunter => {
			const nextShowcaseInMS = new Date(hunter.lastShowcaseTimestamp).valueOf() + timeConversion(1, "w", "ms");
			if (runMode === "production" && Date.now() < nextShowcaseInMS) {
				interaction.reply({ content: `You can showcase another bounty in <t:${Math.floor(nextShowcaseInMS / 1000)}:R>.`, flags: [MessageFlags.Ephemeral] });
				return;
			}

			const existingBounties = await logicLayer.bounties.findOpenBounties(posterId, interaction.guildId);
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
			}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
				if (!interaction.channel.members.has(collectedInteraction.client.user.id)) {
					collectedInteraction.reply({ content: "BountyBot is not in the selected channel.", flags: [MessageFlags.Ephemeral] });
					return;
				}

				if (!interaction.channel.permissionsFor(collectedInteraction.user.id).has(PermissionFlagsBits.ViewChannel & PermissionFlagsBits.SendMessages)) {
					collectedInteraction.reply({ content: "You must have permission to view and send messages in the selected channel to showcase a bounty in it.", flags: [MessageFlags.Ephemeral] });
					return;
				}

				const bounty = await existingBounties.find(bounty => bounty.id === collectedInteraction.values[0]).reload();
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
				const completions = await logicLayer.bounties.findBountyCompletions(collectedInteraction.values[0]);
				const currentPosterLevel = poster.getLevel(company.xpCoefficient);
				updatePosting(collectedInteraction.guild, company, bounty, currentPosterLevel, completions);
				return buildBountyEmbed(bounty, collectedInteraction.guild, currentPosterLevel, false, company, completions).then(async embed => {
					if (interaction.channel.archived) {
						await interaction.channel.setArchived(false, "bounty showcased");
					}
					return interaction.channel.send({ content: `${collectedInteraction.member} increased the reward on their bounty!`, embeds: [embed] });
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
		})
	}
);
