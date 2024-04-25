const { DataTypes } = require("sequelize");
const { connectToDatabase } = require("../../../../database.js");

connectToDatabase("migration").then(async database => {
	const queryInterface = database.getQueryInterface();
	queryInterface.changeColumn("Completion", "bountyId", {
		type: DataTypes.UUID
	})
	// database.query(`ALTER TABLE Completion ADD COLUMN temp_id UUID`);
	// database.query(`UPDATE Bounty SET temp_description = description`);
	// database.query(`ALTER TABLE Bounty DROP COLUMN description`);
	// database.query(`ALTER TABLE Bounty RENAME COLUMN temp_id TO id`);
});
