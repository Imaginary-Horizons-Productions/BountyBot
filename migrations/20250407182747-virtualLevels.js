'use strict';

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
		const hunterTableDescription = await queryInterface.describeTable("Hunter");
		if (!("level" in hunterTableDescription)) {
			await queryInterface.addColumn("Hunter", "level", { type: Sequelize.BIGINT, defaultValue: 1 });
		}
		const [hunters] = await queryInterface.sequelize.query("SELECT * FROM Hunter;");
		const companyXPCoefficientMap = {};
		for (const hunter of hunters) {
			if (!(hunter.companyId in companyXPCoefficientMap)) {
				const [result] = await queryInterface.sequelize.query(`SELECT xpCoefficient FROM Company WHERE id IS ${hunter.companyId};`);
				companyXPCoefficientMap[hunter.companyId] = result[0].xpCoefficient;
			}
			await queryInterface.sequelize.query(`UPDATE Hunter SET level = ${Math.floor(Math.sqrt(hunter.xp / companyXPCoefficientMap[hunter.companyId]) + 1)} WHERE userId is ${hunter.userId} AND companyId is ${hunter.companyId}`);
		}

		const companyTableDescription = await queryInterface.describeTable("Company");
		if (!("level" in companyTableDescription)) {
			await queryInterface.addColumn("Company", "level", { type: Sequelize.INTEGER, defaultValue: 1 });
		}
		const [companies] = await queryInterface.sequelize.query("SELECT * FROM Company;");
		for (const company of companies) {
			const [result] = await queryInterface.sequelize.query(`SELECT SUM(level) FROM Hunter WHERE companyId IS ${company.id};`);
			await queryInterface.sequelize.query(`UPDATE Company SET level = ${Math.floor(Math.sqrt(result[0]["SUM(level)"] / 3) + 1)} WHERE id IS ${company.id}`);
		}
	}
};
