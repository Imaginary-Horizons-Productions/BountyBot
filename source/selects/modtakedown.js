const { database } = require('../../database');
const { SelectWrapper } = require('../classes');
const { getRankUpdates } = require('../helpers');

const mainId = "modtakedown";
module.exports = new SelectWrapper(mainId, 3000,
	/** Take down specified bounty */
	(interaction, [posterId]) => {
		const slotNumber = interaction.values[0];
		database.models.Bounty.findOne({ where: { userId: posterId, companyId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
			await database.models.Completion.destroy({ where: { bountyId: bounty.id } });
			bounty.state = "deleted";
			bounty.save();
			const company = await database.models.Company.findOne({ where: { id: interaction.guildId } });
			if (company.bountyBoardId) {
				const bountyBoard = await interaction.guild.channels.fetch(company.bountyBoardId);
				const postingThread = await bountyBoard.threads.fetch(bounty.postingId);
				postingThread.delete("Bounty taken down by moderator");
			}
			bounty.destroy();

			database.models.Hunter.findOne({ where: { userId: posterId, companyId: interaction.guildId } }).then(async poster => {
				poster.decrement("xp");
				const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
				const [seasonParticipation, participationCreated] = await database.models.SeasonParticipation.findOrCreate({ where: { userId: posterId, companyId: interaction.guildId, seasonId: season.id }, defaults: { xp: -1 } });
				if (!participationCreated) {
					seasonParticipation.decrement("xp");
				}
				getRankUpdates(interaction.guild);
			})
			interaction.reply({ content: `<@${posterId}>'s bounty **${bounty.title}** has been taken down by ${interaction.member}.` });
		});
	}
);
