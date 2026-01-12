const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { getNumberEmoji, selectOptionsFromBounties, disabledSelectRow, updateEvergreenBountyBoard } = require("../../shared");
const { SKIP_INTERACTION_HANDLING, SAFE_DELIMITER } = require("../../../constants");
const { Bounty, Company } = require("../../../database/models");

module.exports = new SubcommandWrapper("swap", "Swap the rewards of two evergreen bounties",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const existingBounties = await logicLayer.bounties.findEvergreenBounties(interaction.guild.id);
		if (existingBounties.length < 2) {
			interaction.reply({ content: "There must be at least 2 evergreen bounties for this server to swap.", flags: MessageFlags.Ephemeral });
			return;
		}

		interaction.reply({
			content: "Swapping a bounty to another slot will change the XP reward for that bounty.",
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}evergreen`)
						.setPlaceholder("Select a bounty to swap...")
						.setMaxValues(1)
						.setOptions(selectOptionsFromBounties(existingBounties))
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => {
			const collector = response.resource.message.createMessageComponentCollector({ max: 2 });
			collector.on("collect", async (collectedInteraction) => {
				if (collectedInteraction.customId.endsWith("evergreen")) {
					logicLayer.hunters.findOneHunter(interaction.user.id, interaction.guild.id).then(async hunter => {
						await Promise.all(existingBounties.map(bounty => bounty.reload()));
						const previousBounty = existingBounties.find(bounty => bounty.id === collectedInteraction.values[0]);
						const previousBountySlot = previousBounty.slotNumber;
						const slotOptions = [];
						for (const bounty of existingBounties) {
							if (bounty.slotNumber != previousBountySlot) {
								slotOptions.push(
									{
										emoji: getNumberEmoji(bounty.slotNumber),
										label: `Slot ${bounty.slotNumber}: ${bounty.title}`,
										// Evergreen bounties are not eligible for showcase bonuses
										description: `XP Reward: ${Bounty.calculateCompleterReward(hunter.getLevel(origin.company.xpCoefficient), bounty.slotNumber, 0)}`,
										value: bounty.id
									}
								);
							}
						}

						collectedInteraction.update({
							components: [
								disabledSelectRow(`Selected Bounty: ${previousBounty.title}`),
								new ActionRowBuilder().addComponents(
									new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}${SAFE_DELIMITER}${previousBounty.id}`)
										.setPlaceholder("Select a bounty to swap with...")
										.setMaxValues(1)
										.setOptions(slotOptions)
								)
							],
							flags: MessageFlags.Ephemeral
						})
					})
				} else {
					const sourceBountyId = collectedInteraction.customId.split(SAFE_DELIMITER)[1];

					const sourceBounty = existingBounties.find(bounty => bounty.id === sourceBountyId);
					const sourceSlot = sourceBounty.slotNumber;
					const destinationBounty = existingBounties.find(bounty => bounty.id === collectedInteraction.values[0]);
					const destinationSlot = destinationBounty.slotNumber;
					sourceBounty.slotNumber = destinationSlot;
					await sourceBounty.save();

					destinationBounty.slotNumber = sourceSlot;
					await destinationBounty.save();

					const currentCompanyLevel = Company.getLevel(origin.company.getXP(await logicLayer.hunters.getCompanyHunterMap(collectedInteraction.guild.id)));
					if (origin.company.bountyBoardId) {
						const hunterIdMap = {};
						for (const bounty of existingBounties) {
							hunterIdMap[bounty.id] = await logicLayer.bounties.getHunterIdSet(bounty.id);
						}
						collectedInteraction.guild.channels.fetch(origin.company.bountyBoardId).then(bountyBoard => {
							updateEvergreenBountyBoard(bountyBoard, existingBounties, origin.company, currentCompanyLevel, interaction.guild, hunterIdMap);
						})
					} else if (!collectedInteraction.member.manageable) {
						interaction.followUp({ content: `Looks like your server doesn't have a bounty board channel. Make one with ${commandMention("create-default bounty-board-forum")}?`, flags: MessageFlags.Ephemeral });
					}

					// Evergreen bounties are not eligible for showcase bonuses
					interaction.channel.send(`Some evergreen bounties have been swapped, **${sourceBounty.title}** is now worth ${Bounty.calculateCompleterReward(currentCompanyLevel, destinationSlot, 0)} XP and **${destinationBounty.title}** is now worth ${Bounty.calculateCompleterReward(currentCompanyLevel, sourceSlot, 0)} XP.`);
				}
			})

			collector.on("end", () => {
				interaction.deleteReply();
			})
		})
	}
);
