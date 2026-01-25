const { Company } = require("../../database/models");
const { ItemTemplate, ItemTemplateSet } = require("../classes");
const { syncRankRoles, seasonalScoreboardEmbed, overallScoreboardEmbed, refreshReferenceChannelScoreboard, rewardSummary, consolidateHunterReceipts } = require("../shared");

/** @type {typeof import("../../logic")} */
let logicLayer;

class XPBoost extends ItemTemplate {
	/**
	 * @param {number} value the amount of xp the boost variety provides
	 * @param {string} descriptor the name of the boost variety
	 */
	constructor(value, descriptor) {
		const itemName = `${descriptor} XP Boost`.trimStart();
		super(itemName, `Gain ${value} XP in the used server (unaffected by festivals)`, 60000,
			async (interaction, origin) => {
				const companyReceipt = { guildName: interaction.guild.name };
				const hunterReceipts = new Map().set(interaction.user.id, { xp: value });
				const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
				await logicLayer.seasons.changeSeasonXP(interaction.user.id, interaction.guildId, season.id, value);
				const hunterMap = await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id);
				const previousCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
				const previousHunterLevel = origin.hunter.getLevel(origin.company.xpCoefficient);
				const updatedHunter = await origin.hunter.increment({ xp: value }).then(hunter => hunter.reload());
				const currentHunterLevel = updatedHunter.getLevel(origin.company.xpCoefficient);
				if (currentHunterLevel > previousHunterLevel) {
					hunterReceipts.set(interaction.user.id, { ...hunterReceipts.get(interaction.user.id), levelUp: { achievedLevel: currentHunterLevel, previousLevel: previousHunterLevel } })
				}
				hunterMap.set(interaction.user.id, updatedHunter);
				const currentCompanyLevel = Company.getLevel(origin.company.getXP(hunterMap));
				if (previousCompanyLevel < currentCompanyLevel) {
					companyReceipt.levelUp = currentCompanyLevel;
				}
				const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
				const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
				const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks, await interaction.guild.roles.fetch());
				syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);
				consolidateHunterReceipts(hunterReceipts, seasonalHunterReceipts);
				interaction.reply({ content: `${interaction.member} used an ${itemName}.\n${rewardSummary("item", companyReceipt, hunterReceipts, origin.company.maxSimBounties)}` });
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
	}
}

const varieties = [
	[5, ""],
	[25, "Epic"],
	[75, "Legendary"]
];

module.exports = new ItemTemplateSet(...varieties.map(([value, descriptor]) => new XPBoost(value, descriptor)))
	.setLogicLinker(logicBlob => {
		logicLayer = logicBlob;
	})
