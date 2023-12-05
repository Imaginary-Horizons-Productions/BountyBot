const { SelectWrapper } = require('../classes');
const { getRankUpdates } = require('../util/scoreUtil');

const mainId = "bountytakedown";
module.exports = new SelectWrapper(mainId, 3000,
	/** Take down the given bounty and completions */
	async (interaction, args, database) => {
		const [bountyId] = interaction.values;
		const bounty = await database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company });
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
			const [particiaption, participationCreated] = await database.models.Participation.findOrCreate({ where: { userId: interaction.user.id, companyId: interaction.guildId, seasonId: season.id }, defaults: { xp: -1 } });
			if (!participationCreated) {
				particiaption.decrement("xp");
			}
			getRankUpdates(interaction.guild, database);
		})

		interaction.reply({ content: "Your bounty has been taken down.", ephemeral: true });
	}
);
