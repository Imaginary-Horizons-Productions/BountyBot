const { connectToDatabase } = require("../../../../database.js");

connectToDatabase("migration").then(async database => {
	database.query(`ALTER TABLE Company RENAME COLUMN eventMultiplier TO festivalMultiplier`);

	database.query(`ALTER TABLE Bounty ADD COLUMN temp_description VARCHAR(255)`);
	database.query(`UPDATE Bounty SET temp_description = description`);
	database.query(`ALTER TABLE Bounty DROP COLUMN description`);
	database.query(`ALTER TABLE Bounty RENAME COLUMN temp_description TO description`);
});
