const { Model, Sequelize, DataTypes } = require("sequelize");

/** A Goal for which all bounty hunters in a company contribute to */
exports.Goal = class extends Model { };

/** @param {Sequelize} sequelize */
exports.initModel = function (sequelize) {
	exports.Goal.init({
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
	})
};
