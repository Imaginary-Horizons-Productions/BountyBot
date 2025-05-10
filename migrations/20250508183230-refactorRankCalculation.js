'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const participationTable = await queryInterface.describeTable("Participation");
		if (!("rankIndex" in participationTable)) {
			//TODONOW initialize based on Hunter.rank
			await queryInterface.addColumn("Participation", "rankIndex", Sequelize.INTEGER);
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
		const participationTable = await queryInterface.describeTable("Participation");
		if ("rankIndex" in participationTable) {
			await queryInterface.sequelize.query("ALTER TABLE Participation DROP COLUMN rankIndex");
		}
		//TODONOW recalculate Hunter.rank
		//TODONOW recalculate Hunter.lastRank
		//TODONOW recalculate Hunter.nextRankXP
	}
};
