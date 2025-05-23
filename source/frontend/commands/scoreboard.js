const { InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { seasonalScoreboardEmbed, overallScoreboardEmbed } = require('../shared');

/** @type {typeof import("../../logic")} */
let logicLayer;

const mainId = "scoreboard";
module.exports = new CommandWrapper(mainId, "View the XP scoreboard", null, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	/** View the XP scoreboard */
	async (interaction, runMode) => {
		const [company] = await logicLayer.companies.findOrCreateCompany(interaction.guild.id);
		const embeds = [];
		const ranks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
		if (interaction.options.getString("scoreboard-type") === "season") {
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
			embeds.push(await seasonalScoreboardEmbed(company, interaction.guild, await logicLayer.seasons.findSeasonParticipations(season.id), ranks, goalProgress));
		} else {
			embeds.push(await overallScoreboardEmbed(company, interaction.guild, await logicLayer.hunters.findCompanyHunters(interaction.guild.id), ranks, goalProgress));
		}
		interaction.reply({ embeds, flags: MessageFlags.Ephemeral });
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
