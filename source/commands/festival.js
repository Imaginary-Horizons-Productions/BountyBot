const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');

const mainId = "festival";
const options = [];
const subcommands = [
	{
		name: "start",
		description: "Start an XP multiplier festival",
		optionsInput: [
			{
				type: "Integer",
				name: "multiplier",
				description: "The amount to multiply XP by",
				required: true
			}
		]
	},
	{
		name: "close",
		description: "End the festival, returning to normal XP",
	}
];
module.exports = new CommandWrapper(mainId, "Manage a server-wide festival to multiply XP of bounty completions, toast reciepts, and crit toasts", PermissionFlagsBits.ManageGuild, true, false, 3000, options, subcommands,
	/** Allow users to manage an XP multiplier festival */
	(interaction, database, runMode) => {
		database.models.Company.findOrCreate({ where: { id: interaction.guildId } }).then(([company]) => {
			switch (interaction.options.getSubcommand()) {
				case subcommands[0].name: // start
					const multiplier = interaction.options.getInteger(subcommands[0].optionsInput[0].name);
					if (multiplier < 2) {
						interaction.reply({ content: `Multiplier must be an integer that is 2 or more.`, ephemeral: true })
						return;
					}
					company.update({ "eventMultiplier": multiplier });
					interaction.guild.members.fetchMe().then(bountyBot => {
						const multiplierTag = ` [XP x ${multiplier}]`;
						const bountyBotName = bountyBot.nickname ?? bountyBot.displayName;
						if (bountyBotName.length + multiplierTag.length <= 32) {
							bountyBot.setNickname(`${bountyBotName}${multiplierTag}`);
						}
					})
					interaction.reply(company.sendAnnouncement({ content: `An XP multiplier festival has started. Bounty and toast XP will be multiplied by ${multiplier}.` }));
					break;
				case subcommands[1].name: // close
					company.update({ "eventMultiplier": 1 });
					interaction.guild.members.fetchMe().then(bountyBot => {
						bountyBot.setNickname(null);
					})
					interaction.reply(company.sendAnnouncement({ content: "The XP multiplier festival has ended. Hope you participate next time!" }));
					break;
			}
		});
	}
);