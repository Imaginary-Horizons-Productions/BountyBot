const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("close", "End the festival, returning to normal XP",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, company]) {
		company.update({ "festivalMultiplier": 1 });
		interaction.guild.members.fetchMe().then(bountyBot => {
			bountyBot.setNickname(null);
		})
		interaction.reply(company.sendAnnouncement({ content: "The XP multiplier festival has ended. Hope you participate next time!" }));
	}
);
