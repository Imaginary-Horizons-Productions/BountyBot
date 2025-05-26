/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const [companies] = await queryInterface.sequelize.query("SELECT * from Company;");
		await queryInterface.sequelize.query("ALTER TABLE Company DROP COLUMN festivalMultiplier");
		await queryInterface.addColumn("Company", "festivalMultiplier", Sequelize.REAL, { defaultValue: 1 });
		for (const company of companies) {
			await queryInterface.sequelize.query(`UPDATE Company SET festivalMultiplier = ${company.festivalMultiplier} WHERE id = ${company.id};`);
		}
	},
	async down(queryInterface, Sequelize) {
		const [companies] = await queryInterface.sequelize.query("SELECT * from Company;");
		await queryInterface.sequelize.query("ALTER TABLE Company DROP COLUMN festivalMultiplier");
		await queryInterface.addColumn("Company", "festivalMultiplier", Sequelize.INTEGER, { defaultValue: 1 });
		for (const company of companies) {
			await queryInterface.sequelize.query(`UPDATE Company SET festivalMultiplier = ${Math.ceil(company.festivalMultiplier)} WHERE id = ${company.id};`);
		}
	}
};
