import { InteractionContextType, MessageFlags, SlashCommandStringOption } from 'discord.js';
import type { LogicLayer } from '../../logic';
import { CommandFunctionality } from '../classes';
import { overallScoreboardEmbed, seasonalScoreboardEmbed } from '../shared';

let logicLayer: LogicLayer;

const scoreboardTypeOption = new SlashCommandStringOption().setName("scoreboard-type")
	.setDescription("The Season Scoreboard only includes hunters with XP this season")
	.setChoices(
		{ name: "Season Scoreboard", value: "season" },
		{ name: "Overall Scoreboard", value: "overall" }
	).setRequired(true);

const mainId = "scoreboard";
export default new CommandFunctionality(mainId, "View the XP scoreboard", null, false, [InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel], 3000,
	/** View the XP scoreboard */
	async (interaction, theater, isDevMode) => {
		const embeds = [];
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
		if (interaction.options.getString(scoreboardTypeOption.name) === scoreboardTypeOption.choices?.[0].value) {
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
			embeds.push(await seasonalScoreboardEmbed(theater.company, interaction.guild, await logicLayer.seasons.getParticipationMap(season.id), await logicLayer.ranks.findAllRanks(interaction.guild.id), goalProgress));
		} else {
			embeds.push(await overallScoreboardEmbed(theater.company, interaction.guild, await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id), goalProgress));
		}
		interaction.reply({ embeds, flags: MessageFlags.Ephemeral });
	}
).setOptions(
	scoreboardTypeOption
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
