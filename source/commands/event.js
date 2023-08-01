const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');

const customId = "event";
const options = [];
const subcommands = [
	{
		name: "start",
		description: "Start an XP multiplier event",
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
		description: "End the event, returning to normal XP",
	}
];
module.exports = new CommandWrapper(customId, "Manage a server-wide event that multiplies XP of bounty completions, toast reciepts, and crit toasts", PermissionFlagsBits.ManageGuild, true, false, 3000, options, subcommands,
	/** Allow users to manage XP multiplier events */
	(interaction) => {
		database.models.Guild.findOrCreate({ where: { id: interaction.guildId } }).then(([guildProfile]) => {
			switch (interaction.options.getSubcommand()) {
				case subcommands[0].name: // open-event
					// Default null and 0 to 2
					const multiplier = interaction.options.getInteger(subcommands[0].optionsInput[0].name) || 2;
					guildProfile.update({ "eventMultiplier": multiplier });
					interaction.guild.members.fetchMe().then(bountyBot => {
						bountyBot.setNickname(`${bountyBot.nickname ?? bountyBot.displayName} [XP x ${multiplier}]`);
					})
					interaction.reply(guildProfile.sendAnnouncement({ content: `An XP multiplier event has started. Bounty and toast XP will be multiplied by ${multiplier}.` }));
					break;
				case subcommands[1].name: // close-event
					guildProfile.update({ "eventMultiplier": 1 });
					interaction.guild.members.fetchMe().then(bountyBot => {
						bountyBot.setNickname(null);
					})
					interaction.reply(guildProfile.sendAnnouncement({ content: "The XP multiplier event has ended. Hope you participate next time!" }));
					break;
			}
		});
	}
);
