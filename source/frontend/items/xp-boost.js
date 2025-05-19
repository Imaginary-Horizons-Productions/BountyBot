const { ItemTemplate, ItemTemplateSet } = require("../classes");
const { buildCompanyLevelUpLine, buildHunterLevelUpLine, formatSeasonResultsToRewardTexts, syncRankRoles, seasonalScoreboardEmbed, overallScoreboardEmbed, updateScoreboard } = require("../shared");

/** @type {typeof import("../../logic")} */
let logicLayer;

const itemName = "XP Boost";
const xpValue = 5;
module.exports = new ItemTemplateSet(
	new ItemTemplate(itemName, `Gain ${xpValue} XP in the used server (unaffected by festivals)`, 60000,
		async (interaction) => {
			logicLayer.hunters.findOneHunter(interaction.user.id, interaction.guild.id).then(async hunter => {
				const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
				logicLayer.seasons.changeSeasonXP(interaction.user.id, interaction.guildId, season.id, xpValue);
				const company = await logicLayer.companies.findCompanyByPK(interaction.guildId);
				const allHunters = await logicLayer.hunters.findCompanyHunters(interaction.guild.id);
				const previousCompanyLevel = company.getLevel(allHunters);
				const previousHunterLevel = hunter.getLevel(company.xpCoefficient);
				await hunter.increment({ xp: xpValue }).then(hunter => hunter.reload());
				const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
				const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
				const seasonUpdates = await logicLayer.seasons.updatePlacementsAndRanks(season, participationMap, descendingRanks);
				syncRankRoles(seasonUpdates, descendingRanks, interaction.guild.members);
				const additionalRewards = formatSeasonResultsToRewardTexts(seasonUpdates, descendingRanks, await interaction.guild.roles.fetch());
				let content = `${interaction.member} used an ${itemName} and gained ${xpValue} XP.`;
				const hunterLevelLine = buildHunterLevelUpLine(hunter, previousHunterLevel, company.xpCoefficient, company.maxSimBounties);
				if (hunterLevelLine) {
					additionalRewards.push(hunterLevelLine);
				}
				const reloadedHunters = await Promise.all(allHunters.map(hunter => {
					if (hunter.userId === interaction.user.id) {
						return hunter.reload();
					} else {
						return hunter;
					}
				}))
				const companyLevelLine = buildCompanyLevelUpLine(company, previousCompanyLevel, reloadedHunters, interaction.guild.name);
				if (companyLevelLine) {
					additionalRewards.push(companyLevelLine);
				}
				if (additionalRewards.length > 0) {
					content += `\n- ${additionalRewards.join("\n- ")}`;
				}
				interaction.reply({ content });
				const embeds = [];
				const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
				if (company.scoreboardIsSeasonal) {
					embeds.push(await seasonalScoreboardEmbed(company, interaction.guild, participationMap, descendingRanks, goalProgress));
				} else {
					embeds.push(await overallScoreboardEmbed(company, interaction.guild, await logicLayer.hunters.findCompanyHunters(interaction.guild.id), goalProgress));
				}
				updateScoreboard(company, interaction.guild, embeds);
			})
		}
	)
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
