const { calculateXPStandardDeviation, calculateXPMean } = require('../source/logic/shared');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const participationTable = await queryInterface.describeTable("Participation");
		if (!("rankIndex" in participationTable)) {
			await queryInterface.addColumn("Participation", "rankIndex", Sequelize.INTEGER);
			const [participations] = await queryInterface.sequelize.query("SELECT * FROM Participation;");
			for (const participation of participations) {
				const [[{ rank }]] = await queryInterface.sequelize.query(`SELECT rank FROM Hunter WHERE userId IS ${participation.userId} AND companyId IS ${participation.companyId};`);
				await queryInterface.sequelize.query(`UPDATE Participation SET rankIndex = ${rank} WHERE userId IS ${participation.userId} AND companyId IS ${participation.companyId};`);
			}
		}
		const hunterTable = await queryInterface.describeTable("Hunter");
		if ("rank" in hunterTable) {
			await queryInterface.sequelize.query("ALTER TABLE Hunter DROP COLUMN rank");
		}
		if ("lastRank" in hunterTable) {
			await queryInterface.sequelize.query("ALTER TABLE Hunter DROP COLUMN lastRank");
		}
		if ("nextRankXP" in hunterTable) {
			await queryInterface.sequelize.query("ALTER TABLE Hunter DROP COLUMN nextRankXP");
		}
	},
	async down(queryInterface, Sequelize) {
		const hunterTable = await queryInterface.describeTable("Hunter");
		if (!("nextRankXP" in hunterTable)) {
			await queryInterface.addColumn("Hunter", "nextRankXP", Sequelize.INTEGER);
			const [participations] = await queryInterface.sequelize.query("SELECT * FROM Participation;");
			const companyId = participations[0].companyId;
			const [ranks] = await queryInterface.sequelize.query(`SELECT * FROM Rank WHERE companyId IS ${companyId} ORDER BY varianceThreshold DESC;`);
			const participationMap = new Map();
			for (const participation of participations) {
				participationMap.set(participation.userId, participation)
			}
			const mean = calculateXPMean(participationMap);
			const xpStandardDeviation = calculateXPStandardDeviation(participationMap, mean);
			for (const participation of participations) {
				const nextRankXP = participation?.rankIndex === null || participation.rankIndex === 0 ? 0 : Math.ceil(xpStandardDeviation * ranks[participation.rankIndex - 1].varianceThreshold + mean - participation.xp);
				await queryInterface.sequelize.query(`UPDATE Hunter SET nextRankXP = ${nextRankXP} WHERE userId IS ${participation.userId} AND companyId IS ${companyId};`);
			}
		}
		if (!("rank" in hunterTable)) {
			await queryInterface.addColumn("Hunter", "rank", Sequelize.INTEGER);
			const [participations] = await queryInterface.sequelize.query("SELECT * FROM Participation;");
			for (const participation of participations) {
				await queryInterface.sequelize.query(`UPDATE Hunter SET rank = ${participation.rankIndex} WHERE userId IS ${participation.userId} AND companyId IS ${participation.companyId};`);
			}
		}
		if (!("lastRank" in hunterTable)) {
			await queryInterface.addColumn("Hunter", "lastRank", Sequelize.INTEGER);
			console.log("WARNING cannot restore values of Hunter.lastRank");
		}
		const participationTable = await queryInterface.describeTable("Participation");
		if ("rankIndex" in participationTable) {
			await queryInterface.sequelize.query("ALTER TABLE Participation DROP COLUMN rankIndex");
		}
	}
};
