const { Op } = require('sequelize');
const { database } = require('../../database');
const { SelectWrapper } = require('../classes');

const mainId = "rafflerank";

module.exports = new SelectWrapper(mainId, 3000,
	/** Given selected rank for raffle, randomly select eligible hunter */
	(interaction, args) => {
		const rankIndex = Number(interaction.values[0]);
		database.models.Hunter.findAll({ where: { companyId: interaction.guildId, rank: { [Op.gte]: rankIndex } } }).then(unvalidatedHunters => {
			const qualifiedHunters = unvalidatedHunters.filter(hunter => !hunter.isRankDisqualified);
			return interaction.guild.members.fetch({ user: qualifiedHunters.map(hunter => hunter.userId) });
		}).then((unvalidatedMembers) => {
			const eligibleHunters = unvalidatedMembers.filter(member => member.manageable);
			if (eligibleHunters.size < 1) {
				database.models.Rank.findAll({ where: { companyId: interaction.guildId }, order: [["varianceThreshold", "ASC"]] }).then(ranks => {
					const rank = ranks[rankIndex];
					interaction.reply({ content: `There wouldn't be any eligible bounty hunters for this raffle (at or above the rank ${rank.roleId ? `<@&${rank.roleId}>` : `Rank ${rankIndex + 1}`}).`, ephemeral: true });
				});
				return;
			}
			const winner = eligibleHunters.at(Math.floor(Math.random() * eligibleHunters.size));
			interaction.reply(`The winner of this raffle is: <@${winner.userId}>`);
			database.models.Company.findByPk(interaction.guildId).then(company => {
				company.update("nextRaffleString", null);
			});
		})
	}
);
