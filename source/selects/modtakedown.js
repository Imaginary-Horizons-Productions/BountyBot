const { SelectWrapper } = require('../classes');
const { getRankUpdates } = require('../util/scoreUtil');

const mainId = "modtakedown";
module.exports = new SelectWrapper(mainId, 3000,
	/** Take down specified bounty */
	(interaction, [posterId], database) => {
		const [bountyId] = interaction.values;
		database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company }).then(async bounty => {
			await database.models.Completion.destroy({ where: { bountyId: bounty.id } });
			bounty.state = "deleted";
			bounty.save();
			if (bounty.Company.bountyBoardId) {
				const bountyBoard = await interaction.guild.channels.fetch(bounty.Company.bountyBoardId);
				const postingThread = await bountyBoard.threads.fetch(bounty.postingId);
				postingThread.delete("Bounty taken down by moderator");
			}
			bounty.destroy();

			database.models.Hunter.findOne({ where: { userId: posterId, companyId: interaction.guildId } }).then(async poster => {
				poster.decrement("xp");
				const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
				const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { userId: posterId, companyId: interaction.guildId, seasonId: season.id }, defaults: { xp: -1 } });
				if (!participationCreated) {
					participation.decrement("xp");
				}
				getRankUpdates(interaction.guild, database);
			})
			interaction.reply({ content: `<@${posterId}>'s bounty **${bounty.title}** has been taken down by ${interaction.member}.` });
		});
	}
);
