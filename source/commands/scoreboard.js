const { InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "scoreboard";
module.exports = new CommandWrapper(mainId, "View the XP scoreboard", null, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	/** View the XP scoreboard */
	async (interaction, runMode) => {
		const [company] = await logicLayer.companies.findOrCreateCompany(interaction.guild.id);
		const embeds = [];
		if (interaction.options.getString("scoreboard-type") === "season") {
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
			embeds.push(await company.seasonalScoreboardEmbed(interaction.guild, await logicLayer.seasons.findSeasonParticipations(season.id), await logicLayer.ranks.findAllRanks(interaction.guild.id)));
		} else {
			embeds.push(await company.overallScoreboardEmbed(interaction.guild, await logicLayer.hunters.findCompanyHunters(interaction.guild.id), await logicLayer.ranks.findAllRanks(interaction.guild.id)));
		}
		interaction.reply({ embeds, flags: [MessageFlags.Ephemeral] });
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
