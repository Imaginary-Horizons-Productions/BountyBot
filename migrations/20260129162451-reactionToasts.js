'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const toastDescription = await queryInterface.describeTable("Toast");
		if (!("messageId" in toastDescription)) {
			await queryInterface.addColumn("Toast", "messageId", Sequelize.STRING);
		}
		const companyDecription = await queryInterface.describeTable("Company");
		if (!("disableReactionToasts" in companyDecription)) {
			await queryInterface.addColumn("Company", "disableReactionToasts", Sequelize.BOOLEAN);
		}
	},
	async down(queryInterface, Sequelize) {
		const toastDescription = await queryInterface.describeTable("Toast");
		if ("messageId" in toastDescription) {
			await queryInterface.sequelize.query("ALTER TABLE Toast DROP COLUMN messageId;");
		}
		const companyDescription = await queryInterface.describeTable("Company");
		if ("disableReactionToasts" in companyDescription) {
			await queryInterface.sequelize.query("ALTER TABLE Company DROP COLUMN disableReactionToasts;");
		}
	}
};
