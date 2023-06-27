const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { buildScoreboardEmbed } = require('../embedHelpers');

const customId = "scoreboard";
const options = [
	{
		type: "String",
		name: "scoreboard-type",
		description: "The Season Scoreboard only includes hunters with XP this season",
		required: true,
		choices: [
			{ name: "Season Scoreboard", value: "season" },
			{ name: "Overall Scoreboard", value: "overall" }
		]
	}
];
const subcommands = [];
module.exports = new CommandWrapper(customId, "View the XP scoreboard", PermissionFlagsBits.ViewChannel, false, false, 3000, options, subcommands,
	/** View the XP scoreboard */
	(interaction) => {
		buildScoreboardEmbed(interaction.guild, interaction.options.getString(options[0].name) === "season").then(embed => {
			interaction.reply({
				embeds: [embed],
				ephemeral: true
			});
		})
	}
);
