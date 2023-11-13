const { SelectWrapper } = require('../classes');
const { Bounty } = require('../models/bounties/Bounty');

const mainId = "evergreenswapslot";
module.exports = new SelectWrapper(mainId, 3000,
	/** Complete the swaps */
	async (interaction, [unparsedSourceSlot], database) => {
		const sourceSlot = parseInt(unparsedSourceSlot);
		const destinationSlot = parseInt(interaction.values[0]);
		const company = await database.models.Company.findByPk(interaction.guildId);

		const evergreenBounties = await database.models.Bounty.findAll({ where: { isEvergreen: true, companyId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] });
		const sourceBounty = evergreenBounties.find(bounty => bounty.slotNumber == sourceSlot);
		const destinationBounty = evergreenBounties.find(bounty => bounty.slotNumber == destinationSlot);
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
					message.edit({ embeds: await Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(interaction.guild, company.level, company.eventMultiplierString(), database))) });
				});
			})
		}

		interaction.update({ components: [] });
		// Evergreen bounties are not eligible for showcase bonuses
		interaction.channel.send(`Some evergreen bounties have been swapped, **${sourceBounty.title}** is now worth ${Bounty.calculateReward(company.level, destinationSlot, 0)} XP and **${destinationBounty.title}** is now worth ${Bounty.calculateReward(company.level, sourceSlot, 0)} XP.`);
	}
);
