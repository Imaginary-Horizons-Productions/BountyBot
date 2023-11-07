const { DataTypes, Model, Sequelize } = require('sequelize');

/** This class stores receipts of a toast seconding */
exports.Seconding = class extends Model { }

/** @param {Sequelize} sequelize */
exports.initModel = function (sequelize) {
	exports.Seconding.init({
		toastId: {
			primaryKey: true,
			type: DataTypes.BIGINT
		},
		seconderId: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		wasCrit: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		}
	}, {
		sequelize,
		modelName: "Seconding",
		freezeTableName: true
	});
}
