const { DataTypes } = require("sequelize");
const { connectToDatabase } = require("../../../../database.js");

connectToDatabase("migration").then(async database => {
	const queryInterface = database.getQueryInterface();
	queryInterface.addColumn("Participation", "toastsRaised", { type: DataTypes.INTEGER, defaultValue: 0 });
});
