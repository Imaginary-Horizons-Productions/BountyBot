const { SelectWrapper } = require('../classes');
const { database } = require('../../database');
const { getRankUpdates } = require('../helpers');

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
			if (hunter.seasonParticipationId) {
				const seasonParticipation = await database.models.SeasonParticipation.findByPk(hunter.seasonParticipationId)
				seasonParticipation.decrement("xp");
			} else {
				const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
				const seasonParticpation = await database.models.SeasonParticipation.create({
					userId: hunter.userId,
					companyId: interaction.guildId,
					seasonId: season.id,
					xp: -1
				});
				hunter.seasonParticipationId = seasonParticpation.id;
				hunter.save();
			}
			getRankUpdates(interaction.guild);
		})

		interaction.reply({ content: "Your bounty has been taken down.", ephemeral: true });
	}
);
