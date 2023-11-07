const { SelectWrapper } = require('../classes');
const { database } = require('../../database');
const { getRankUpdates } = require('../util/scoreUtil');

const mainId = "bountytakedown";
module.exports = new SelectWrapper(mainId, 3000,
	/** Take down the given bounty and completions */
	async (interaction, args) => {
		const [slotNumber] = interaction.values;
		const bounty = await database.models.Bounty.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId, slotNumber, state: "open" }, include: database.models.Bounty.Company });
		bounty.state = "deleted";
		bounty.save();
		database.models.Completion.destroy({ where: { bountyId: bounty.id } });
		if (bounty.Company.bountyBoardId) {
			const bountyBoard = await interaction.guild.channels.fetch(bounty.Company.bountyBoardId);
			const postingThread = await bountyBoard.threads.fetch(bounty.postingId);
			postingThread.delete("Bounty taken down by poster");
		}
		bounty.destroy();

		database.models.Hunter.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId } }).then(async hunter => {
			hunter.decrement("xp");
			const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
			const [seasonParticipation, participationCreated] = await database.models.SeasonParticipation.findOrCreate({ where: { userId: interaction.user.id, companyId: interaction.guildId, seasonId: season.id }, defaults: { xp: -1 } });
			if (!participationCreated) {
				seasonParticipation.decrement("xp");
			}
			getRankUpdates(interaction.guild);
		})

		interaction.reply({ content: "Your bounty has been taken down.", ephemeral: true });
	}
);
