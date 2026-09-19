import { DatabaseTypes } from "../../database/index.ts";
import type { LogicLayer } from "../../logic";
import type { CompanyReciept } from "../../shared/types";
import { ItemTemplate, ItemTemplateSet } from "../classes/index.ts";
import { consolidateHunterReceipts, refreshReferenceChannelScoreboardOverall, refreshReferenceChannelScoreboardSeasonal, rewardSummary, syncRankRoles } from "../shared/index.ts";

let logicLayer: LogicLayer;

class XPBoost extends ItemTemplate {
	constructor(value: number, descriptor: string) {
		const itemName = `${descriptor} XP Boost`.trimStart();
		super(itemName, `Gain ${value} XP in the used server (unaffected by festivals)`, 60000,
			async (interaction, theater) => {
				const companyReceipt: CompanyReciept = { guildName: interaction.guild.name };
				const hunterReceipts = new Map().set(interaction.user.id, { xp: value });
				const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
				await logicLayer.seasons.changeSeasonXP(interaction.user.id, interaction.guildId, season.id, value);
				const hunterMap = await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id);
				const previousCompanyLevel = DatabaseTypes.Company.getLevel(theater.company.getXP(hunterMap));
				const previousHunterLevel = theater.hunter.getLevel(theater.company.xpCoefficient);
				const updatedHunter = await theater.hunter.increment({ xp: value }).then(hunter => hunter.reload());
				const currentHunterLevel = updatedHunter.getLevel(theater.company.xpCoefficient);
				if (currentHunterLevel > previousHunterLevel) {
					hunterReceipts.set(interaction.user.id, { ...hunterReceipts.get(interaction.user.id), levelUp: { achievedLevel: currentHunterLevel, previousLevel: previousHunterLevel } })
				}
				hunterMap.set(interaction.user.id, updatedHunter);
				const currentCompanyLevel = DatabaseTypes.Company.getLevel(theater.company.getXP(hunterMap));
				if (previousCompanyLevel < currentCompanyLevel) {
					companyReceipt.levelUp = currentCompanyLevel;
				}
				const descendingRanks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
				const participationMap = await logicLayer.seasons.getParticipationMap(season.id);
				const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(participationMap, descendingRanks, await interaction.guild.roles.fetch());
				syncRankRoles(seasonalHunterReceipts, descendingRanks, interaction.guild.members);
				consolidateHunterReceipts(hunterReceipts, seasonalHunterReceipts);
				interaction.reply({ content: `${interaction.member} used an ${itemName}.\n${rewardSummary("item", companyReceipt, hunterReceipts, theater.company.maxSimBounties)}` });
				const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
				if (theater.company.scoreboardIsSeasonal) {
					refreshReferenceChannelScoreboardSeasonal(theater.company, interaction.guild, participationMap, descendingRanks, goalProgress);
				} else {
					refreshReferenceChannelScoreboardOverall(theater.company, interaction.guild, hunterMap, goalProgress);
				}
				return 1;
			}
		)
	}
}

const varieties: [number, string][] = [
	[5, ""],
	[25, "Epic"],
	[75, "Legendary"]
];

export default new ItemTemplateSet(...varieties.map(([value, descriptor]) => new XPBoost(value, descriptor)))
	.setLogicLinker(logicBlob => {
		logicLayer = logicBlob;
	})
