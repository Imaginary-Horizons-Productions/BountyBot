const { Guild } = require("discord.js");
const { Bounty, Hunter } = require("../../../database/models");
const { butIgnoreMissingPermissionErrors } = require("../dAPIResponses");
const { syncRankRoles } = require("../dAPIRequests");

/**
 * @param {typeof import("../../../logic")} logicLayer
 * @param {Guild} guild
 * @param {Bounty} bounty
 * @param {Hunter} posterHunter
 * @param {import("discord.js").ForumThreadChannel | undefined} bountyThread
 */
async function bountyTakeDown(logicLayer, guild, bounty, posterHunter, bountyThread) {
	await logicLayer.bounties.deleteBountyCompletions(bounty.id);
	if (bountyThread) {
		bountyThread.delete("Bounty taken down by poster").catch(butIgnoreMissingPermissionErrors);
	}
	if (bounty.scheduledEventId) {
		guild.scheduledEvents.delete(bounty.scheduledEventId).catch(butIgnoreMissingPermissionErrors);
	}
	bounty.destroy();

	posterHunter.decrement("xp");
	const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(bounty.companyId);
	await logicLayer.seasons.changeSeasonXP(bounty.userId, bounty.companyId, season.id, -1);
	const descendingRanks = await logicLayer.ranks.findAllRanks(bounty.companyId);
	const seasonalHunterReceipts = await logicLayer.seasons.updatePlacementsAndRanks(await logicLayer.seasons.getParticipationMap(season.id), descendingRanks, await guild.roles.fetch());
	syncRankRoles(seasonalHunterReceipts, descendingRanks, guild.members);
}

module.exports = {
	bountyTakeDown
};
