/**
 * All logical components for stats commands.
 * Database is currently managed by being passed in from the
 * calling function, but this file should likely have a direct
 * reference to the database to prevent the need to keep passing
 * the database constantly.
 */
const { Hunter } = require('../models/users/Hunter');
const { Op } = require('sequelize');

async function statsForUser(userId, companyId, database) {
    let hunter = await database.models.Hunter.findOne({ where: { userId, companyId } });

    if (!hunter) {
        throw "The specified user doesn't seem to have a profile with this server's BountyBot yet. It'll be created when they gain XP.";
    }

    const { xpCoefficient, maxSimBounties } = await database.models.Company.findByPk(companyId);
    const currentLevelThreshold = Hunter.xpThreshold(hunter.level, xpCoefficient);
    const nextLevelThreshold = Hunter.xpThreshold(hunter.level + 1, xpCoefficient);
    const bountySlots = hunter.maxSlots(maxSimBounties);
    const participations = await database.models.Participation.findAll({ where: { userId: hunter.userId, companyId: hunter.companyId }, order: [["createdAt", "DESC"]] });
    const [currentSeason] = await database.models.Season.findOrCreate({ where: { companyId, isCurrentSeason: true } });
    const currentParticipation = participations.find(participation => participation.seasonId === currentSeason.id);
    const previousParticipations = currentParticipation === null ? participations : participations.slice(1);
    const ranks = await database.models.Rank.findAll({ where: { companyId }, order: [["varianceThreshold", "DESC"]] });
    const rankName = ranks[hunter.rank]?.roleId ? `<@&${ranks[hunter.rank].roleId}>` : `Rank ${hunter.rank + 1}`;
    const mostSecondedToast = await database.models.Toast.findOne({ where: { senderId: userId, companyId, secondings: { [Op.gt]: 0 } }, order: [["secondings", "DESC"]] });
    const upcomingRewards = [hunterLevel + 1, hunterLevel + 2, hunterLevel + 3].map(level => `Level ${level}\n- ${hunter.levelUpReward(level, maxSimBounties, true).join("\n- ")}`);

    return {
        currentLevelThreshold,
        currentParticipation,
        nextLevelThreshold,
        previousParticipations,
        rank: hunter.rank,
        othersFinished: hunter.othersFinished,
        mineFinished: hunter.mineFinished,
        toastsRaised: hunter.toastsRaised,
        toastsSeconded: hunter.toastsSeconded,
        toastsReceived: hunter.toastsReceived,
        rankName,
        mostSecondedToast,
        nextRankXP: hunter.nextRankXP,
        bountySlots,
        hunterLevel: hunter.level,
        hunterXP: hunter.xp,
        profileColor: hunter.profileColor,
        upcomingRewards
    };

}

async function statsForCompany(guild, database) {
	const [company] = await database.models.Company.findOrCreate({ where: { id: guild.id } });
	const [currentSeason] = await database.models.Season.findOrCreate({ where: { companyId: guild.id, isCurrentSeason: true } });
	const lastSeason = await database.models.Season.findOne({ where: { companyId: guild.id, isPreviousSeason: true } });
	const participantCount = await database.models.Participation.count({ where: { seasonId: currentSeason.id } });
	const companyXP = await company.xp;
	const currentSeasonXP = await currentSeason.totalXP;
	const lastSeasonXP = await lastSeason?.totalXP ?? 0;

	const currentLevelThreshold = Hunter.xpThreshold(company.level, COMPANY_XP_COEFFICIENT);
	const nextLevelThreshold = Hunter.xpThreshold(company.level + 1, COMPANY_XP_COEFFICIENT);
	const participantPercentage = participantCount / guild.memberCount * 100;
	const seasonXPDifference = currentSeasonXP - lastSeasonXP;
	const seasonBountyDifference = currentSeason.bountiesCompleted - (lastSeason?.bountiesCompleted ?? 0);
	const seasonToastDifference = currentSeason.toastsRaised - (lastSeason?.toastsRaised ?? 0);

    return {
        level: company.level,
        companyXP,
        currentLevelThreshold,
        nextLevelThreshold,
        participantCount,
        participantPercentage,
        currentSeasonXP, 
        bountiesCompleted: currentSeason.bountiesCompleted,
        seasonXPDifference,
        seasonBountyDifference,
        toastsRaised: currentSeason.toastsRaised,
        seasonToastDifference, 
    };
}

module.exports = { statsForUser, statsForCompany }