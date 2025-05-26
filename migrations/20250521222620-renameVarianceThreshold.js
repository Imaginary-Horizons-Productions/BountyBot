/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.sequelize.query(`ALTER TABLE Rank RENAME COLUMN varianceThreshold TO threshold;`);
	},
	async down(queryInterface, Sequelize) {
		await queryInterface.sequelize.query(`ALTER TABLE Rank RENAME COLUMN threshold TO varianceThreshold;`);
	}
};
