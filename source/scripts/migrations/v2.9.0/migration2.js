const { DataTypes } = require("sequelize");
const { connectToDatabase } = require("../../../../database.js");

connectToDatabase("migration").then(async database => {
	const queryInterface = database.getQueryInterface();
	queryInterface.createTable("Goal", {
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		companyId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		state: { // "ongoing", "expired", "completed"
			type: DataTypes.STRING,
			defaultValue: "ongoing"
		},
		type: { // "bounties", "toasts", "secondings"
			type: DataTypes.STRING,
			allowNull: false
		},
		requiredContributions: {
			type: DataTypes.BIGINT,
			allowNull: false
		}
	}, {
		sequelize,
		modelName: "Goal",
		freezeTableName: true
	});
	queryInterface.createTable("Contribution", {
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		goalId: {
			type: DataTypes.UUID,
			allowNull: false
		},
		userId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		value: {
			type: DataTypes.BIGINT,
			allowNull: false
		}
	}, {
		sequelize,
		modelName: "Contribution",
		freezeTableName: true
	});
});
