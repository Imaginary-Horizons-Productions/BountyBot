const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer]) {
	const company = await logicLayer.companies.findCompanyByPK(interaction.guild.id);
	const announcement = interaction.options.getString("announcement");
	company.update({ nextRaffleString: announcement });
	interaction.reply(company.sendAnnouncement({ content: announcement }));
};

module.exports = {
	data: {
		name: "announce-upcoming",
		description: "Announce an upcoming raffle",
		optionsInput: [
			{
				type: "String",
				name: "announcement",
				description: "A timestamp and/or eligibilty requirements can encourage interaction",
				required: true
			}
		]
	},
	executeSubcommand
};
