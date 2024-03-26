const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { Sequelize } = require("sequelize");
const { getNumberEmoji, trimForSelectOptionDescription } = require("../../util/textUtil");
const { SKIP_INTERACTION_HANDLING, SAFE_DELIMITER } = require("../../constants");
const { Bounty } = require("../../models/bounties/Bounty");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const existingBounties = await database.models.Bounty.findAll({ where: { isEvergreen: true, companyId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] });
	if (existingBounties.length < 2) {
		interaction.reply({ content: "There must be at least 2 evergreen bounties for this server to swap.", ephemeral: true });
		return;
	}

	interaction.reply({
		content: "Swapping a bounty to another slot will change the XP reward for that bounty.",
		components: [
			new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}evergreen`)
					.setPlaceholder("Select a bounty to swap...")
					.setMaxValues(1)
					.setOptions(existingBounties.map(bounty => {
						const optionPayload = {
							emoji: getNumberEmoji(bounty.slotNumber),
							label: bounty.title,
							value: bounty.id
						}
						if (bounty.description !== null) {
							optionPayload.description = trimForSelectOptionDescription(bounty.description);
						}
						return optionPayload;
					}))
			)
		],
		ephemeral: true,
		fetchReply: true
	}).then(reply => {
		const collector = reply.createMessageComponentCollector({ max: 2 });
		collector.on("collect", async (collectedInteraction) => {
			if (collectedInteraction.customId.endsWith("evergreen")) {
				database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId: interaction.user.id } }).then(async hunter => {
					const existingBounties = await database.models.Bounty.findAll({ where: { isEvergreen: true, companyId: interaction.guildId, state: "open" } });
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
									description: `XP Reward: ${Bounty.calculateCompleterReward(hunter.level, bounty.slotNumber, 0)}`,
									value: bounty.id
								}
							);
						}
					}

					collectedInteraction.update({
						components: [
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder().setCustomId("disabled")
									.setPlaceholder(`Selected Bounty: ${previousBounty.title}`)
									.setDisabled(true)
									.addOptions([{ label: "placeholder", value: "placeholder" }])
							),
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}${SAFE_DELIMITER}${previousBounty.id}`)
									.setPlaceholder("Select a bounty to swap with...")
									.setMaxValues(1)
									.setOptions(slotOptions)
							)
						],
						ephemeral: true
					})
				})
			} else {
				const sourceBountyId = collectedInteraction.customId.split(SAFE_DELIMITER)[1];
				const company = await database.models.Company.findByPk(interaction.guildId);

				const evergreenBounties = await database.models.Bounty.findAll({ where: { isEvergreen: true, companyId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] });
				const sourceBounty = evergreenBounties.find(bounty => bounty.id === sourceBountyId);
				const sourceSlot = sourceBounty.slotNumber;
				const destinationBounty = evergreenBounties.find(bounty => bounty.id === collectedInteraction.values[0]);
				const destinationSlot = destinationBounty.slotNumber;
				sourceBounty.slotNumber = destinationSlot;
				await sourceBounty.save();

				destinationBounty.slotNumber = sourceSlot;
				await destinationBounty.save();

				if (company.bountyBoardId) {
					interaction.guild.channels.fetch(company.bountyBoardId).then(bountyBoard => {
						bountyBoard.threads.fetch(company.evergreenThreadId).then(thread => {
							return thread.fetchStarterMessage();
						}).then(async message => {
							evergreenBounties.sort((bountyA, bountyB) => bountyA.slotNumber - bountyB.slotNumber);
							message.edit({ embeds: await Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(interaction.guild, company.level, company.festivalMultiplierString(), false, database))) });
						});
					})
				}

				// Evergreen bounties are not eligible for showcase bonuses
				interaction.channel.send(`Some evergreen bounties have been swapped, **${sourceBounty.title}** is now worth ${Bounty.calculateCompleterReward(company.level, destinationSlot, 0)} XP and **${destinationBounty.title}** is now worth ${Bounty.calculateCompleterReward(company.level, sourceSlot, 0, 0).completerReward} XP.`);
			}
		})

		collector.on("end", () => {
			interaction.deleteReply();
		})
	})
};

module.exports = {
	data: {
		name: "swap",
		description: "Swap the rewards of two evergreen bounties"
	},
	executeSubcommand
};
