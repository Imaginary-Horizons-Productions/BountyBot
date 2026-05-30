const { InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { seasonalScoreboardEmbed, overallScoreboardEmbed } = require('../shared');

/** @type {import('../../shared/types').LogicLayer} */
let logicLayer;

const mainId = "scoreboard";
module.exports = new CommandWrapper(mainId, "View the XP scoreboard", null, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	/** View the XP scoreboard */
	async (interaction, theater, isDevMode) => {
		const embeds = [];
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
		if (interaction.options.getString("scoreboard-type") === "season") {
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
			embeds.push(await seasonalScoreboardEmbed(theater.company, interaction.guild, await logicLayer.seasons.getParticipationMap(season.id), await logicLayer.ranks.findAllRanks(interaction.guild.id), goalProgress));
		} else {
			embeds.push(await overallScoreboardEmbed(theater.company, interaction.guild, await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id), goalProgress));
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
