const { DataTypes } = require("sequelize");
const { connectToDatabase } = require("../../../../database.js");

connectToDatabase("migration").then(async database => {
	const queryInterface = database.getQueryInterface();
	queryInterface.addColumn("Toast", "secondings", { type: DataTypes.BIGINT, defaultValue: 0 });
});
