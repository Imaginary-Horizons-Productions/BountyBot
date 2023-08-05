const { Op } = require('sequelize');
const { database } = require('../../database');
const { InteractionWrapper } = require('../classes');
const { Bounty } = require('../models/bounties/Bounty');

const customId = "bountyswapslot";
module.exports = new InteractionWrapper(customId, 3000,
	/** Complete the swaps */
	async (interaction, [unparsedSourceSlot]) => {
		const sourceSlot = parseInt(unparsedSourceSlot);
		const destinationSlot = parseInt(interaction.values[0]);
		const guildProfile = await database.models.Guild.findByPk(interaction.guildId);

		const bounties = await database.models.Bounty.findAll({ where: { userId: interaction.user.id, guildId: interaction.guildId, slotNumber: { [Op.in]: [sourceSlot, destinationSlot] }, state: "open" } });
		const sourceBounty = bounties.find(bounty => bounty.slotNumber == sourceSlot);
		const destinationBounty = bounties.find(bounty => bounty.slotNumber == destinationSlot);
		sourceBounty.slotNumber = destinationSlot;
		await sourceBounty.save();
		await sourceBounty.reload();
		sourceBounty.updatePosting(interaction.guild, guildProfile);

		if (destinationBounty) {
			destinationBounty.slotNumber = sourceSlot;
			await destinationBounty.save();
			await destinationBounty.reload();
			destinationBounty.updatePosting(interaction.guild, guildProfile);
		}

		const hunter = await database.models.Hunter.findOne({ where: { userId: interaction.user.id, guildId: interaction.guildId } });
		interaction.update({ components: [] });
		interaction.channel.send(`${interaction.member}'s bounty, **${sourceBounty.title}** is now worth ${Bounty.slotWorth(hunter.level, destinationSlot)} XP.`);
	}
);
