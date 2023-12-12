const { CommandInteraction } = require("discord.js");
const { Sequelize, Op } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const levelThreshold = interaction.options.getInteger("level");
	const eligibleHunters = await database.models.Hunter.findAll({ where: { companyId: interaction.guildId, level: { [Op.gte]: levelThreshold } } });
	const eligibleMembers = await interaction.guild.members.fetch({ user: eligibleHunters.map(hunter => hunter.userId) });
	const eligibleIds = eligibleMembers.filter(member => member.manageable).map(member => member.id);
	if (eligibleIds.size < 1) {
		interaction.reply({ content: `There wouldn't be any eligible bounty hunters for this raffle (at or above level ${levelThreshold}).`, ephemeral: true });
		return;
	}
	const winnerId = eligibleIds.at(Math.floor(Math.random() * eligibleIds.size));
	interaction.reply(`The winner of this raffle is: <@${winnerId}>`);
	database.models.Company.findByPk(interaction.guildId).then(company => {
		company.update("nextRaffleString", null);
	});
};

module.exports = {
	data: {
		name: "by-level",
		description: "Select a user at or above a particular level",
		optionsInput: [
			{
				type: "Integer",
				name: "level",
				description: "The level a hunter needs to be eligible for this raffle",
				required: true
			}
		]
	},
	executeSubcommand
};
