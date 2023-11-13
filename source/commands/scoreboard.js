const { CommandWrapper } = require('../classes');
const { buildSeasonalScoreboardEmbed, buildOverallScoreboardEmbed } = require('../util/embedUtil');

const mainId = "scoreboard";
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
module.exports = new CommandWrapper(mainId, "View the XP scoreboard", null, false, false, 3000, options, subcommands,
	/** View the XP scoreboard */
	(interaction, database, runMode) => {
		if (interaction.options.getString(options[0].name) === "season") {
			buildSeasonalScoreboardEmbed(interaction.guild, database).then(embed => {
				interaction.reply({
					embeds: [embed],
					ephemeral: true
				});
			})
		} else {
			buildOverallScoreboardEmbed(interaction.guild, database).then(embed => {
				interaction.reply({
					embeds: [embed],
					ephemeral: true
				});
			})
		}
	}
);
