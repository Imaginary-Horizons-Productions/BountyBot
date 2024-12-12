const { Model, Sequelize, DataTypes } = require("sequelize");

/** A bounty hunter's Contribution to a company Goal */
exports.Contribution = class extends Model { };

/** @param {Sequelize} sequelize */
exports.initModel = function (sequelize) {
	exports.Contribution.init({
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
	})
};
