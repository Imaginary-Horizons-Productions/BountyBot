'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.sequelize.query(`ALTER TABLE Goal RENAME COLUMN requiredContributions TO requiredGP`);
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.sequelize.query(`ALTER TABLE Goal RENAME COLUMN requiredGP TO requiredContributions`);
	}
};
