const { DataTypes, Model, Sequelize } = require('sequelize');

/** This class stores receipts of toast transactions */
exports.Recipient = class extends Model { }

/** @param {Sequelize} sequelize */
exports.initModel = function (sequelize) {
	exports.Recipient.init({
		toastId: {
			primaryKey: true,
			type: DataTypes.BIGINT
		},
		recipientId: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		isRewarded: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		wasCrit: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		}
	}, {
		sequelize,
		modelName: "Recipient",
		freezeTableName: true
	});
}
