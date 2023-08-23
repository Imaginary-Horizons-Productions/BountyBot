const { InteractionWrapper } = require('../classes');
const { database } = require('../../database');
const { getRankUpdates } = require('../helpers');

const customId = "bountytakedown";
module.exports = new InteractionWrapper(customId, 3000,
	/** Take down the given bounty and completions */
	async (interaction, args) => {
		const [slotNumber] = interaction.values;
		const bounty = await database.models.Bounty.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId, slotNumber, state: "open" }, include: database.models.Bounty.Company });
		bounty.state = "deleted";
		bounty.save();
		database.models.Completion.destroy({ where: { bountyId: bounty.id } });
		if (bounty.Company.bountyBoardId) {
			const bountyBoard = await interaction.guild.channels.fetch(company.bountyBoardId);
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
				const company = await database.models.Company.findOne({ where: { id: interaction.guildId } });
				const seasonParticpation = await database.models.SeasonParticipation.create({
					userId: hunter.userId,
					companyId: company.id,
					seasonId: company.seasonId,
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
