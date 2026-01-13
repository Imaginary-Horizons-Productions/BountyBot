const { unorderedList } = require("discord.js");
const { Company } = require("../../database/models");
const { ItemTemplate, ItemTemplateSet } = require("../classes");
const { companyLevelUpLine, buildHunterLevelUpLine, formatSeasonResultsToRewardTexts, syncRankRoles, seasonalScoreboardEmbed, overallScoreboardEmbed, refreshReferenceChannelScoreboard } = require("../shared");

/** @type {typeof import("../../logic")} */
let logicLayer;

const itemName = "XP Boost";
const xpValue = 5;
module.exports = new ItemTemplateSet(
	new ItemTemplate(itemName, `Gain ${xpValue} XP in the used server (unaffected by festivals)`, 60000,
		async (interaction, origin) => {
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
			logicLayer.seasons.changeSeasonXP(interaction.user.id, interaction.guildId, season.id, xpValue);
			const hunterMap = await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id);
			const previousCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
			const previousHunterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
			await origin.hunter.increment({ xp: xpValue }).then(hunter => hunter.reload());
			const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
			const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
			const seasonUpdates = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks);
			syncRankRoles(seasonUpdates, descendingRanks, interaction.guild.members);
			const additionalRewards = formatSeasonResultsToRewardTexts(seasonUpdates, descendingRanks, await interaction.guild.roles.fetch());
			let content = `${interaction.member} used an ${itemName} and gained ${xpValue} XP.`;
			const hunterLevelLine = buildHunterLevelUpLine(origin.hunter, previousHunterLevel, origin.company.xpCoefficient, origin.company.maxSimBounties);
			if (hunterLevelLine) {
				additionalRewards.push(hunterLevelLine);
			}
			hunterMap.set(interaction.user.id, await hunterMap.get(interaction.user.id).reload());
			const companyLevelLine = companyLevelUpLine(origin.company, previousCompanyLevel, hunterMap, interaction.guild.name);
			if (companyLevelLine) {
				additionalRewards.push(companyLevelLine);
			}
			if (additionalRewards.length > 0) {
				content += `\n${unorderedList(additionalRewards)}`;
			}
			interaction.reply({ content });
			const embeds = [];
			const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
			if (origin.company.scoreboardIsSeasonal) {
				embeds.push(await seasonalScoreboardEmbed(origin.company, interaction.guild, participationMap, descendingRanks, goalProgress));
			} else {
				embeds.push(await overallScoreboardEmbed(origin.company, interaction.guild, hunterMap, goalProgress));
			}
			refreshReferenceChannelScoreboard(origin.company, interaction.guild, embeds);
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
