const { Op } = require('sequelize');
const { database } = require('../../database');
const { InteractionWrapper } = require('../classes');

const customId = "rafflerank";

module.exports = new InteractionWrapper(customId, 3000,
	/** Given selected rank for raffle, randomly select eligible hunter */
	(interaction, args) => {
		const rankIndex = Number(interaction.values[0]);
		database.models.Hunter.findAll({ where: { guildId: interaction.guildId, isRankEligible: true, isRankDisqualified: false, rank: { [Op.gte]: rankIndex } } }).then(eligibleHunters => {
			if (eligibleHunters.length < 1) {
				database.models.GuildRank.findAll({ where: { guildId: interaction.guildId }, order: [["varianceThreshold", "ASC"]] }).then(ranks => {
					const rank = ranks[rankIndex];
					interaction.reply({ content: `There wouldn't be any eligible bounty hunters for this raffle (at or above the rank ${rank.roleId ? `<@&${rank.rankId}>` : `Rank ${rankIndex + 1}`}).`, ephemeral: true });
				});
				return;
			}
			const winner = eligibleHunters[Math.floor(Math.random() * eligibleHunters.length)];
			interaction.reply(`The winner of this raffle is: <@${winner.userId}>`);
			database.models.Guild.findByPk(interaction.guildId).then(guildProfile => {
				guildProfile.update("nextRaffleString", null);
			});
		})
	}
);
