const { database } = require('../../database');
const { InteractionWrapper } = require('../classes');
const { Bounty } = require('../models/bounties/Bounty');

const customId = "evergreenswapslot";
module.exports = new InteractionWrapper(customId, 3000,
	/** Complete the swaps */
	async (interaction, [unparsedSourceSlot]) => {
		const sourceSlot = parseInt(unparsedSourceSlot);
		const destinationSlot = parseInt(interaction.values[0]);
		const guildProfile = await database.models.Guild.findByPk(interaction.guildId);

		const evergreenBounties = await database.models.Bounty.findAll({ where: { isEvergreen: true, guildId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] });
		const sourceBounty = evergreenBounties.find(bounty => bounty.slotNumber == sourceSlot);
		const destinationBounty = evergreenBounties.find(bounty => bounty.slotNumber == destinationSlot);
		sourceBounty.slotNumber = destinationSlot;
		await sourceBounty.save();

		destinationBounty.slotNumber = sourceSlot;
		await destinationBounty.save();

		if (guildProfile.bountyBoardId) {
			interaction.guild.channels.fetch(guildProfile.bountyBoardId).then(bountyBoard => {
				bountyBoard.threads.fetch(guildProfile.evergreenThreadId).then(thread => {
					return thread.fetchStarterMessage();
				}).then(async message => {
					evergreenBounties.sort((bountyA, bountyB) => bountyA.slotNumber - bountyB.slotNumber);
					message.edit({ embeds: await Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(interaction.guild, guildProfile.level, guildProfile.eventMultiplierString()))) });
				});
			})
		}

		interaction.update({ components: [] });
		// Evergreen bounties are not eligible for showcase bonuses
		interaction.channel.send(`Some evergreen bounties have been swapped, **${sourceBounty.title}** is now worth ${Bounty.calculateReward(guildProfile.level, destinationSlot, 0)} XP and **${destinationBounty.title}** is now worth ${Bounty.calculateReward(guildProfile.level, sourceSlot, 0)} XP.`);
	}
);
