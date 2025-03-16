const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("announce-upcoming", "Announce an upcoming raffle",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		const company = await logicLayer.companies.findCompanyByPK(interaction.guild.id);
		const announcement = interaction.options.getString("announcement");
		company.update({ nextRaffleString: announcement });
		interaction.reply(company.sendAnnouncement({ content: announcement }));
	}
).setOptions(
	{
		type: "String",
		name: "announcement",
		description: "A timestamp and/or eligibilty requirements can encourage interaction",
		required: true
	}
);
