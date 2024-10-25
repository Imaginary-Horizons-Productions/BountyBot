const { DataTypes } = require("sequelize");
const { connectToDatabase } = require("../../../../database.js");

connectToDatabase("migration").then(async database => {
	const queryInterface = database.getQueryInterface();
	queryInterface.addColumn("Hunter", "itemFindBoost", { type: DataTypes.BOOLEAN, defaultValue: false });
	queryInterface.addColumn("Hunter", "goalsInitiated", { type: DataTypes.BIGINT, defaultValue: 0 });
	queryInterface.addColumn("Hunter", "goalContributions", { type: DataTypes.BIGINT, defaultValue: 0 });
	queryInterface.addColumn("Participation", "goalContributions", { type: DataTypes.INTEGER, defaultValue: 0 });
	queryInterface.removeColumn("Company", "serverBonusesThumbnailURL");
});
