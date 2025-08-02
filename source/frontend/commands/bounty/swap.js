const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, bold } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { Bounty, Hunter } = require("../../../database/models");
const { getNumberEmoji, bountiesToSelectOptions, updatePosting, sendAnnouncement, disabledSelectRow } = require("../../shared");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");

module.exports = new SubcommandWrapper("swap", "Move one of your bounties to another slot to change its reward",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guild.id).then(openBounties => {
			if (openBounties.length < 1) {
				interaction.reply({ content: "You don't seem to have any open bounties at the moment.", flags: MessageFlags.Ephemeral });
				return;
			}

			interaction.reply({
				content: "Swapping a bounty to another slot will change the XP reward for that bounty.",
				components: [
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}bounty`)
							.setPlaceholder("Select a bounty to swap...")
							.setMaxValues(1)
							.setOptions(bountiesToSelectOptions(openBounties))
					)
				],
				flags: MessageFlags.Ephemeral,
				withResponse: true
			}).then(response => {
				const collector = response.resource.message.createMessageComponentCollector({ max: 2 });
				collector.on("collect", async (collectedInteraction) => {
					let previousBounty = openBounties.find(bounty => bounty.id === collectedInteraction.values[0]);
					if (collectedInteraction.customId.endsWith("bounty")) {
						const bountySlotCount = Hunter.getBountySlotCount(origin.hunter.getLevel(origin.company.xpCoefficient), origin.company.maxSimBounties);
						if (bountySlotCount < 2) {
							collectedInteraction.reply({ content: "You currently only have 1 bounty slot in this server.", flags: MessageFlags.Ephemeral });
							return;
						}

						const existingBounties = await logicLayer.bounties.findOpenBounties(interaction.user.id, interaction.guildId);
						const slotOptions = [];
						for (let i = 1; i <= bountySlotCount; i++) {
							if (i != previousBounty.slotNumber) {
								const existingBounty = existingBounties.find(bounty => bounty.slotNumber == i);
								slotOptions.push(
									{
										emoji: getNumberEmoji(i),
										label: `Slot ${i}: ${existingBounty?.title ?? "Empty"}`,
										description: `XP Reward: ${Bounty.calculateCompleterReward(origin.hunter.getLevel(origin.company.xpCoefficient), i, existingBounty?.showcaseCount ?? 0)}`,
										value: i.toString()
									}
								)
							}
						}

						collectedInteraction.update({
							content: "If there is a bounty in the destination slot, it'll be swapped to the old bounty's slot.",
							components: [
								disabledSelectRow(`Selected Bounty: ${previousBounty.title}`),
								new ActionRowBuilder().addComponents(
									new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
										.setPlaceholder("Select a slot to swap the bounty to...")
										.setMaxValues(1)
										.setOptions(slotOptions)
								)
							],
							flags: MessageFlags.Ephemeral
						})
					} else {
						await previousBounty.reload();
						if (previousBounty.state !== "open") {
							collectedInteraction.update({ content: "The selected bounty appears to already have been completed.", components: [] });
							return;
						}

						const hunterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
						const sourceSlot = previousBounty.slotNumber;
						const destinationSlot = parseInt(collectedInteraction.values[0]);
						let destinationBounty = await logicLayer.bounties.findBounty({ slotNumber: destinationSlot, userId: origin.user.id, companyId: origin.company.id });

						previousBounty = await previousBounty.update({ slotNumber: destinationSlot });
						updatePosting(interaction.guild, origin.company, previousBounty, hunterLevel, await logicLayer.bounties.getHunterIdSet(previousBounty.id));

						if (destinationBounty?.state === "open") {
							destinationBounty = await destinationBounty.update({ slotNumber: sourceSlot });
							updatePosting(interaction.guild, origin.company, destinationBounty, hunterLevel, await logicLayer.bounties.getHunterIdSet(destinationBounty.id));
						}

						interaction.channel.send(sendAnnouncement(origin.company, { content: `${interaction.member}'s bounty, ${bold(previousBounty.title)} is now worth ${Bounty.calculateCompleterReward(hunterLevel, destinationSlot, previousBounty.showcaseCount)} XP.` }));
					}
				})

				collector.on("end", () => {
					interaction.deleteReply();
				})
			})
		})
	}
);
