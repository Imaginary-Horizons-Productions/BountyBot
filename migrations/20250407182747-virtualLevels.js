'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.removeColumn("Hunter", "level");
		await queryInterface.removeColumn("Company", "xp");
		await queryInterface.removeColumn("Company", "level");
	},
	async down(queryInterface, Sequelize) {
		console.log("WARNING virtualLevels migration not reversible because it deletes columns");
	}
};
