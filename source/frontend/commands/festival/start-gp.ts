import { SlashCommandNumberOption, type Snowflake } from "discord.js";
import { DatabaseTypes } from "../../../database";
import { SubcommandFunctionality } from "../../classes";
import { addCompanyAnnouncementPrefix, refreshEvergreenBountiesThread, refreshReferenceChannelScoreboardOverall, refreshReferenceChannelScoreboardSeasonal, updateBotNicknameForFestival } from "../../shared";
import { ensureNumberFromSlashOptionIsGreaterThanOne } from "../_earlyOuts";

const multiplierOption = new SlashCommandNumberOption().setName("multiplier")
	.setDescription("The amount to multiply GP by")
	.setRequired(true);

export default new SubcommandFunctionality("start-gp", "Start a GP multiplier festival",
	ensureNumberFromSlashOptionIsGreaterThanOne(multiplierOption.name, async function executeSubcommand(interaction, theater, isDevMode, logicLayer, multiplier) {
		theater.company.update({ "gpFestivalMultiplier": multiplier });
		updateBotNicknameForFestival(await interaction.guild.members.fetchMe(), theater.company);
		interaction.reply(addCompanyAnnouncementPrefix(theater.company, { content: `A GP multiplier festival has started. Goal Point Contributions will be multiplied by ${multiplier}.` }));
		const goalProgress = await logicLayer.goals.findLatestGoalProgress(theater.company.id);
		if (theater.company.scoreboardIsSeasonal) {
			const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(theater.company.id);
			refreshReferenceChannelScoreboardSeasonal(theater.company, interaction.guild, await logicLayer.seasons.getParticipationMap(season.id), await logicLayer.ranks.findAllRanks(theater.company.id), goalProgress);
		} else {
			refreshReferenceChannelScoreboardOverall(theater.company, interaction.guild, await logicLayer.hunters.getCompanyHunterMap(theater.company.id), goalProgress);
		}
		if (theater.company.bountyBoardId) {
			const bountyBoard = await interaction.guild.channels.fetch(theater.company.bountyBoardId);
			const evergreenBounties = await logicLayer.bounties.findEvergreenBounties(theater.company.id);
			const hunterIdMap: Record<Snowflake, Set<Snowflake>> = {};
			for (const bounty of evergreenBounties) {
				hunterIdMap[bounty.id] = await logicLayer.bounties.getHunterIdSet(bounty.id);
			}
			refreshEvergreenBountiesThread(bountyBoard, evergreenBounties, theater.company, DatabaseTypes.Company.getLevel(theater.company.getXP(await logicLayer.hunters.getCompanyHunterMap(theater.company.id))), interaction.guild.members.me, hunterIdMap);
		}
	})
).setOptions(multiplierOption);
