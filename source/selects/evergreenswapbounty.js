const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { SelectWrapper } = require('../classes');
const { Bounty } = require('../models/bounties/Bounty');
const { SAFE_DELIMITER } = require('../constants');
const { getNumberEmoji } = require('../util/textUtil');

const mainId = "evergreenswapbounty";
module.exports = new SelectWrapper(mainId, 3000,
	/** Recieve the bounty to swap and solicit the slot to swap to */
	(interaction, args, database) => {
		database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId: interaction.user.id } }).then(async hunter => {
			const existingBounties = await database.models.Bounty.findAll({ where: { isEvergreen: true, companyId: interaction.guildId, state: "open" } });
			const previousBountySlot = parseInt(interaction.values[0]);
			const slotOptions = [];
			for (const bounty of existingBounties) {
				if (bounty.slotNumber != previousBountySlot) {
					slotOptions.push(
						{
							emoji: getNumberEmoji(bounty.slotNumber),
							label: `Slot ${bounty.slotNumber}: ${bounty.title}`,
							// Evergreen bounties are not eligible for showcase bonuses
							description: `XP Reward: ${Bounty.calculateReward(hunter.level, bounty.slotNumber, 0)}`,
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
