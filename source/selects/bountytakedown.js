const { InteractionWrapper } = require('../classes');
const { database } = require('../../database');
const { getRankUpdates } = require('../helpers');

const customId = "bountytakedown";
module.exports = new InteractionWrapper(customId, 3000,
	/** Take down the given bounty and completions */
	async (interaction, args) => {
		const [slotNumber] = interaction.values;
		const bounty = await database.models.Bounty.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId, slotNumber, state: "open" } });
		bounty.state = "deleted";
		bounty.save();
		database.models.Completion.destroy({ where: { bountyId: bounty.id } });
		const company = await database.models.Company.findOne({ where: { id: interaction.guildId } });
		company.decrement("seasonXP");
		company.save();
		if (company.bountyBoardId) {
			const bountyBoard = await interaction.guild.channels.fetch(company.bountyBoardId);
			const postingThread = await bountyBoard.threads.fetch(bounty.postingId);
			postingThread.delete("Bounty taken down by poster");
		}
		bounty.destroy();

		database.models.Hunter.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId } }).then(hunter => {
			hunter.decrement(["xp", "seasonXP"], { by: 1 });
			getRankUpdates(interaction.guild);
		})

		interaction.reply({ content: "Your bounty has been taken down.", ephemeral: true });
	}
);
