'use strict';

const { QueryInterface, Op } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	/** @type {(queryInterface: QueryInterface) => void} */
	async up(queryInterface, Sequelize) {
		queryInterface.sequelize.query("DELETE FROM Bounty WHERE deletedAt IS NOT NULL;");
		queryInterface.sequelize.query("DELETE FROM Season WHERE deletedAt IS NOT NULL;");
		queryInterface.sequelize.query("DELETE FROM Company WHERE deletedAt IS NOT NULL;");

		queryInterface.sequelize.query("ALTER TABLE Bounty DROP COLUMN deletedAt;");
		queryInterface.sequelize.query("ALTER TABLE Season DROP COLUMN deletedAt;");
		queryInterface.sequelize.query("ALTER TABLE Company DROP COLUMN deletedAt;");
	},

	async down(queryInterface, Sequelize) {
		console.log("WARNING removeParanoid migration not reversible because it deletes rows");
	}
};
