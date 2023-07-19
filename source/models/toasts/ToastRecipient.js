const { DataTypes, Model } = require('sequelize');

/** This class stores receipts of toast transactions */
exports.ToastRecipient = class ToastRecipient extends Model { }

exports.initModel = function (sequelize) {
	exports.ToastRecipient.init({
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
		modelName: 'ToastRecipient',
		freezeTableName: true
	});
}
