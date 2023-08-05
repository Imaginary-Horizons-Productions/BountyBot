const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { database } = require('../../database');
const { InteractionWrapper } = require('../classes');
const { Bounty } = require('../models/bounties/Bounty');
const { SAFE_DELIMITER } = require('../constants');
const { getNumberEmoji } = require('../helpers');

const customId = "bountyswapbounty";
module.exports = new InteractionWrapper(customId, 3000,
	/** Recieve the bounty to swap and solicit the slot to swap to */
	(interaction, args) => {
		database.models.Hunter.findOne({ where: { guildId: interaction.guildId, userId: interaction.user.id } }).then(async hunter => {
			if (hunter.maxSlots() < 2) {
				interaction.reply({ content: "You currently only have 1 bounty slot in this server.", ephemeral: true });
				return;
			}

			const existingBounties = await database.models.Bounty.findAll({ where: { userId: interaction.user.id, guildId: interaction.guildId, state: "open" } });
			const previousBountySlot = parseInt(interaction.values[0]);
			const guildProfile = await database.models.Guild.findByPk(interaction.guildId);
			const slotOptions = [];
			for (let i = 1; i <= hunter.maxSlots(guildProfile.maxSimBounties); i++) {
				if (i != previousBountySlot) {
					const existingBounty = existingBounties.find(bounty => bounty.slotNumber == i);
					slotOptions.push(
						{
							emoji: getNumberEmoji(i),
							label: `Slot ${i}: ${existingBounty?.title ?? "Empty"}`,
							description: `XP Reward: ${Bounty.slotWorth(hunter.level, i)}`,
							value: i.toString()
						}
					)
				}
			}

			const previousBounty = existingBounties.find(bounty => bounty.slotNumber == previousBountySlot);
			interaction.update({
				content: "If there is a bounty in the destination slot, it'll be swapped to the old bounty's slot.",
				components: [
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder().setCustomId("disabled")
							.setPlaceholder(`Selected Bounty: ${previousBounty.title}`)
							.setDisabled(true)
							.addOptions([{ label: "placeholder", value: "placeholder" }])
					),
					new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder().setCustomId(`bountyswapslot${SAFE_DELIMITER}${previousBountySlot}`)
							.setPlaceholder("Select a slot to swap the bounty to...")
							.setMaxValues(1)
							.setOptions(slotOptions)
					)
				],
				ephemeral: true
			})
		})
	}
);
