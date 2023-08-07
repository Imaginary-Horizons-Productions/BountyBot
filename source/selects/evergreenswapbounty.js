const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { database } = require('../../database');
const { InteractionWrapper } = require('../classes');
const { Bounty } = require('../models/bounties/Bounty');
const { SAFE_DELIMITER } = require('../constants');
const { getNumberEmoji } = require('../helpers');

const customId = "evergreenswapbounty";
module.exports = new InteractionWrapper(customId, 3000,
	/** Recieve the bounty to swap and solicit the slot to swap to */
	(interaction, args) => {
		database.models.Hunter.findOne({ where: { guildId: interaction.guildId, userId: interaction.user.id } }).then(async hunter => {
			const existingBounties = await database.models.Bounty.findAll({ where: { isEvergreen: true, guildId: interaction.guildId, state: "open" } });
			const previousBountySlot = parseInt(interaction.values[0]);
			const slotOptions = [];
			for (const bounty of existingBounties) {
				if (bounty.slotNumber != previousBountySlot) {
					slotOptions.push(
						{
							emoji: getNumberEmoji(bounty.slotNumber),
							label: `Slot ${bounty.slotNumber}: ${bounty.title}`,
							description: `XP Reward: ${Bounty.slotWorth(hunter.level, bounty.slotNumber)}`,
							value: bounty.slotNumber.toString()
						}
					);
				}
			}

			const previousBounty = existingBounties.find(bounty => bounty.slotNumber == previousBountySlot);
			interaction.update({
				components: [
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder().setCustomId("disabled")
							.setPlaceholder(`Selected Bounty: ${previousBounty.title}`)
							.setDisabled(true)
							.addOptions([{ label: "placeholder", value: "placeholder" }])
					),
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder().setCustomId(`evergreenswapslot${SAFE_DELIMITER}${previousBountySlot}`)
							.setPlaceholder("Select a bounty to swap with...")
							.setMaxValues(1)
							.setOptions(slotOptions)
					)
				],
				ephemeral: true
			})
		})
	}
);
