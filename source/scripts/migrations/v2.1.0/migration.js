const { DataTypes } = require("sequelize");
const { connectToDatabase } = require("../../../../database.js");

connectToDatabase("migration").then(async database => {
	const queryInterface = database.getQueryInterface();
	queryInterface.addColumn("Company", "bountyBoardOpenTagId", { type: DataTypes.STRING });
	queryInterface.addColumn("Company", "bountyBoardCompletedTagId", { type: DataTypes.STRING });
});
