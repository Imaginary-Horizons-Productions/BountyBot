const { SubcommandWrapper } = require("../../classes");
const { sendAnnouncement } = require("../../shared");

module.exports = new SubcommandWrapper("announce-upcoming", "Announce an upcoming raffle",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const announcement = interaction.options.getString("announcement");
		origin.company.update({ nextRaffleString: announcement });
		interaction.reply(sendAnnouncement(origin.company, { content: announcement }));
	}
).setOptions(
	{
		type: "String",
		name: "announcement",
		description: "A timestamp and/or eligibilty requirements can encourage interaction",
		required: true
	}
);
