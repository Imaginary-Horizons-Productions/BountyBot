const { CommandInteraction } = require("discord.js");

/**
 * @param {CommandInteraction} interaction
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
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
