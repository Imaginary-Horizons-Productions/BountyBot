const { DataTypes } = require("sequelize");
const { connectToDatabase } = require("../../../../database.js");

connectToDatabase("migration").then(async database => {
	const queryInterface = database.getQueryInterface();
	queryInterface.addColumn("Company", "toastThumbnailURL", { type: DataTypes.STRING });
	queryInterface.addColumn("Company", "openBountyThumbnailURL", { type: DataTypes.STRING });
	queryInterface.addColumn("Company", "completedBountyThumbnailURL", { type: DataTypes.STRING });
	queryInterface.addColumn("Company", "scoreboardThumbnailURL", { type: DataTypes.STRING });
	queryInterface.addColumn("Company", "serverBonusesThumbnailURL", { type: DataTypes.STRING });
});
