import type { ForumThreadChannel, Guild } from "discord.js";
import { DatabaseTypes } from "../../../database/index.ts";
import type { LogicLayer } from "../../../logic";
import { syncRankRoles } from "../dAPIRequests.ts";
import { butIgnoreErrorIf, butIgnoreMissingPermissionErrors, isMissingPermissionError, isUnknownGuildScheduledEventError } from "../dAPIResponses.ts";

export async function bountyTakeDown(logicLayer: LogicLayer, guild: Guild, bounty: DatabaseTypes.Bounty, posterHunter: DatabaseTypes.Hunter, bountyThread: ForumThreadChannel | null) {
	await logicLayer.bounties.deleteBountyCompletions(bounty.id);
	if (bountyThread) {
		bountyThread.delete("Bounty taken down by poster").catch(butIgnoreMissingPermissionErrors);
	}
	if (bounty.scheduledEventId) {
		guild.scheduledEvents.delete(bounty.scheduledEventId).catch(butIgnoreErrorIf(isUnknownGuildScheduledEventError, isMissingPermissionError));
	}
	bounty.destroy();

	posterHunter.decrement("xp");
	const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(bounty.companyId);
	await logicLayer.seasons.changeSeasonXP(bounty.userId, bounty.companyId, season.id, -1);
	const descendingRanks = await logicLayer.ranks.findAllRanks(bounty.companyId);
	const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(await logicLayer.seasons.getParticipationMap(season.id), descendingRanks, await guild.roles.fetch());
	return syncRankRoles(seasonalHunterReceipts, descendingRanks, guild.members);
}
