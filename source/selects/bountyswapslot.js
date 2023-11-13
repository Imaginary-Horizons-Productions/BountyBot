const { Op } = require('sequelize');
const { SelectWrapper } = require('../classes');
const { Bounty } = require('../models/bounties/Bounty');

const mainId = "bountyswapslot";
module.exports = new SelectWrapper(mainId, 3000,
	/** Complete the swaps */
	async (interaction, [unparsedSourceSlot], database) => {
		const sourceSlot = parseInt(unparsedSourceSlot);
		const destinationSlot = parseInt(interaction.values[0]);
		const company = await database.models.Company.findByPk(interaction.guildId);

		const bounties = await database.models.Bounty.findAll({ where: { userId: interaction.user.id, companyId: interaction.guildId, slotNumber: { [Op.in]: [sourceSlot, destinationSlot] }, state: "open" } });
		const sourceBounty = bounties.find(bounty => bounty.slotNumber == sourceSlot);
		const destinationBounty = bounties.find(bounty => bounty.slotNumber == destinationSlot);
		sourceBounty.slotNumber = destinationSlot;
		await sourceBounty.save();
		await sourceBounty.reload();
		sourceBounty.updatePosting(interaction.guild, company, database);

		if (destinationBounty) {
			destinationBounty.slotNumber = sourceSlot;
			await destinationBounty.save();
			await destinationBounty.reload();
			destinationBounty.updatePosting(interaction.guild, company, database);
		}

		const hunter = await database.models.Hunter.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId } });
		interaction.update({ components: [] });
		interaction.channel.send(company.sendAnnouncement({ content: `${interaction.member}'s bounty, **${sourceBounty.title}** is now worth ${Bounty.calculateReward(hunter.level, destinationSlot, sourceBounty.showcaseCount)} XP.` }));
	}
);
