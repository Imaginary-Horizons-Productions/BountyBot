const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");
const { Company } = require("../../models/companies/Company");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[Company]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[company]) {
	company.update({ "eventMultiplier": 1 });
	interaction.guild.members.fetchMe().then(bountyBot => {
		bountyBot.setNickname(null);
	})
	interaction.reply(company.sendAnnouncement({ content: "The XP multiplier festival has ended. Hope you participate next time!" }));
};

module.exports = {
	data: {
		name: "close",
		description: "End the festival, returning to normal XP",
	},
	executeSubcommand
};
