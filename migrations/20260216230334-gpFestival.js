'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const tableDescription = await queryInterface.describeTable("Company");
		if (!("xpFestivalMultiplier" in tableDescription)) {
			await queryInterface.sequelize.query(`ALTER TABLE Company RENAME COLUMN festivalMultiplier TO xpFestivalMultiplier;`);
		}
		if (!("gpFestivalMultiplier" in tableDescription)) {
			await queryInterface.addColumn("Company", "gpFestivalMultiplier", {
				type: Sequelize.REAL,
				defaultValue: 1
			});
		}
		if (!("nickname" in tableDescription)) { // GuildMemberLimits.MaximumDisplayNameLength = 32 at time of writing
			await queryInterface.addColumn("Company", "nickname", Sequelize.STRING(32));
		}
	},
	async down(queryInterface, Sequelize) {
		const tableDescription = await queryInterface.describeTable("Company");
		if ("xpFestivalMultiplier" in tableDescription) {
			await queryInterface.sequelize.query(`ALTER TABLE Company RENAME COLUMN xpFestivalMultiplier TO festivalMultiplier;`);
		}
		if ("gpFestivalMultiplier" in tableDescription) {
			await queryInterface.removeColumn("Company", "gpFestivalMultiplier");
		}
		if ("nickname" in tableDescription) {
			await queryInterface.removeColumn("Company", "nickname");
		}
	}
};
