const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { SelectWrapper } = require('../classes');
const { Bounty } = require('../models/bounties/Bounty');
const { SAFE_DELIMITER } = require('../constants');
const { getNumberEmoji } = require('../util/textUtil');

const mainId = "bountyswapbounty";
module.exports = new SelectWrapper(mainId, 3000,
	/** Recieve the bounty to swap and solicit the slot to swap to */
	(interaction, args, database) => {
		database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId: interaction.user.id } }).then(async hunter => {
			if (hunter.maxSlots() < 2) {
				interaction.reply({ content: "You currently only have 1 bounty slot in this server.", ephemeral: true });
				return;
			}

			const existingBounties = await database.models.Bounty.findAll({ where: { userId: interaction.user.id, companyId: interaction.guildId, state: "open" } });
			const previousBountySlot = parseInt(interaction.values[0]);
			const company = await database.models.Company.findByPk(interaction.guildId);
			const slotOptions = [];
			for (let i = 1; i <= hunter.maxSlots(company.maxSimBounties); i++) {
				if (i != previousBountySlot) {
					const existingBounty = existingBounties.find(bounty => bounty.slotNumber == i);
					slotOptions.push(
						{
							emoji: getNumberEmoji(i),
							label: `Slot ${i}: ${existingBounty?.title ?? "Empty"}`,
							description: `XP Reward: ${Bounty.calculateReward(hunter.level, i, existingBounty?.showcaseCount ?? 0)}`,
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
