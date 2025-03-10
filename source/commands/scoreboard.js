const { InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { buildSeasonalScoreboardEmbed, buildOverallScoreboardEmbed } = require('../util/embedUtil');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "scoreboard";
module.exports = new CommandWrapper(mainId, "View the XP scoreboard", null, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	/** View the XP scoreboard */
	(interaction, database, runMode) => {
		if (interaction.options.getString("scoreboard-type") === "season") {
			buildSeasonalScoreboardEmbed(interaction.guild, logicLayer).then(embed => {
				interaction.reply({
					embeds: [embed],
					flags: [MessageFlags.Ephemeral]
				});
			})
		} else {
			buildOverallScoreboardEmbed(interaction.guild, database, logicLayer).then(embed => {
				interaction.reply({
					embeds: [embed],
					flags: [MessageFlags.Ephemeral]
				});
			})
		}
	}
).setOptions(
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
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
