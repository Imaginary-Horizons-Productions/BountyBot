/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		for (const table of ["Goal", "Contribution"]) {
			const tableDescription = await queryInterface.describeTable(table);
			const updatedColumnEntries = [];
			if (!("createdAt" in tableDescription)) {
				await queryInterface.addColumn(table, "createdAt", { type: Sequelize.Sequelize.DataTypes.DATE, allowNull: false });
				updatedColumnEntries.push(["createdAt", new Date()]);
			}
			if (!("updatedAt" in tableDescription)) {
				await queryInterface.addColumn(table, "updatedAt", { type: Sequelize.Sequelize.DataTypes.DATE, allowNull: false });
				updatedColumnEntries.push(["updatedAt", new Date()]);
			}
			await queryInterface.bulkUpdate(table, Object.fromEntries(updatedColumnEntries));
		}
	},
	async down(queryInterface, Sequelize) {
		await queryInterface.removeColumn("Goal", "createdAt");
		await queryInterface.removeColumn("Goal", "updatedAt");
		await queryInterface.removeColumn("Contribution", "createdAt");
		await queryInterface.removeColumn("Contribution", "updatedAt");
	}
};
