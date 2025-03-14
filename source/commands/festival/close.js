const { CommandInteraction } = require("discord.js");
const { Company } = require("../../models/companies/Company");

/**
 * @param {CommandInteraction} interaction
 * @param {string} runMode
 * @param {[typeof import("../../logic"), Company]} args
 */
async function executeSubcommand(interaction, runMode, ...[logicLayer, company]) {
	company.update({ "festivalMultiplier": 1 });
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
