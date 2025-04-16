'use strict';
function xpToLevel(xp, xpCoefficient = 3) {
	return Math.floor(Math.sqrt(xp / xpCoefficient) + 1);
}
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		for (const table of ["Hunter", "Company"]) {
			const tableDescription = await queryInterface.describeTable(table);
			if ("level" in tableDescription) {
				await queryInterface.sequelize.query(`ALTER TABLE ${table} DROP COLUMN level`);
			}
		}
	},
	async down(queryInterface, Sequelize) {
		//region structure
		const hunterTableDescription = await queryInterface.describeTable("Hunter");
		if (!("level" in hunterTableDescription)) {
			await queryInterface.addColumn("Hunter", "level", { type: Sequelize.BIGINT, defaultValue: 1 });
		}
		const companyTableDescription = await queryInterface.describeTable("Company");
		if (!("level" in companyTableDescription)) {
			await queryInterface.addColumn("Company", "level", { type: Sequelize.INTEGER, defaultValue: 1 });
		}
		//endregion
		//region data
		const [hunters] = await queryInterface.sequelize.query("SELECT * FROM Hunter;");
		const [companies] = await queryInterface.sequelize.query("SELECT * FROM Company;");
		const companyXPCoefficientMap = {};
		for (const company of companies) { // Set up XP map
			companyXPCoefficientMap[company.id] = company.xpCoefficient;
		}
		for (const hunter of hunters) { // Set hunter levels
			await queryInterface.sequelize.query(`UPDATE Hunter SET level = ${xpToLevel(hunter.xp, companyXPCoefficientMap[hunter.companyId])} WHERE userId is ${hunter.userId} AND companyId is ${hunter.companyId}`);
		}

		for (const company of companies) { // Set company levels
			const [result] = await queryInterface.sequelize.query(`SELECT SUM(level) FROM Hunter WHERE companyId IS ${company.id};`);
			await queryInterface.sequelize.query(`UPDATE Company SET level = ${xpToLevel(result[0]["SUM(level)"])} WHERE id IS ${company.id}`);
		}
		//endregion
	}
};
