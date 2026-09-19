import { MessageFlags } from "discord.js";
import { SubcommandFunctionality } from "../../classes/index.ts";
import { butIgnoreCantDirectMessageThisUserErrors, refreshReferenceChannelScoreboardOverall, refreshReferenceChannelScoreboardSeasonal } from "../../shared/index.ts";

export default new SubcommandFunctionality("all-hunter-stats", "IRREVERSIBLY reset all bounty hunter stats on this server",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		await logicLayer.toasts.deleteCompanyToasts(theater.company.id);
		logicLayer.hunters.deleteCompanyHunters(theater.company.id);
		interaction.reply({ content: "Resetting bounty hunter stats has begun.", flags: MessageFlags.Ephemeral });
		const season = await logicLayer.seasons.findOneSeason(theater.company.id, "current");
		if (season) {
			await logicLayer.seasons.deleteSeasonParticipations(season.id);
			await season.destroy();
		}
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(theater.company.id);
		if (theater.company.scoreboardIsSeasonal) {
			refreshReferenceChannelScoreboardSeasonal(theater.company, interaction.guild, new Map(), await logicLayer.ranks.findAllRanks(theater.company.id), goalProgress);
		} else {
			refreshReferenceChannelScoreboardOverall(theater.company, interaction.guild, new Map(), goalProgress);
		}
		interaction.user.send(`Resetting bounty hunter stats on ${interaction.guild.name} has completed.`)
			.catch(butIgnoreCantDirectMessageThisUserErrors);
	}
);
