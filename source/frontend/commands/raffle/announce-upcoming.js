const { SubcommandWrapper } = require("../../classes");
const { addCompanyAnnouncementPrefix } = require("../../shared");

module.exports = new SubcommandWrapper("announce-upcoming", "Announce an upcoming raffle",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		const announcement = interaction.options.getString("announcement");
		theater.company.update({ nextRaffleString: announcement });
		interaction.reply(addCompanyAnnouncementPrefix(theater.company, { content: announcement }));
	}
).setOptions(
	{
		type: "String",
		name: "announcement",
		description: "A timestamp and/or eligibilty requirements can encourage interaction",
		required: true
	}
);
