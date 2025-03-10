const { InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "scoreboard";
module.exports = new CommandWrapper(mainId, "View the XP scoreboard", null, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	/** View the XP scoreboard */
	async (interaction, database, runMode) => {
		const [company] = await logicLayer.companies.findOrCreateCompany(interaction.guild.id);
		interaction.reply({
			embeds: [
				interaction.options.getString("scoreboard-type") === "season" ?
					await company.seasonalScoreboardEmbed(interaction.guild, logicLayer) :
					await company.overallScoreboardEmbed(interaction.guild, logicLayer)
			],
			flags: [MessageFlags.Ephemeral]
		});
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
