'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const tableDescription = await queryInterface.describeTable("Company");
		if (!("deletedBountyThumbnailURL" in tableDescription)) {
			await queryInterface.addColumn("Company", "deletedBountyThumbnailURL", Sequelize.STRING);
		}
	},

	async down(queryInterface, Sequelize) {
		const tableDescription = await queryInterface.describeTable("Company");
		if ("deletedBountyThumbnailURL" in tableDescription) {
			await queryInterface.sequelize.query("ALTER TABLE Company DROP COLUMN deletedBountyThumbnailURL");
		}
	}
};
