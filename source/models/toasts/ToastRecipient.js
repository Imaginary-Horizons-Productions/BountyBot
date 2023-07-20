const { DataTypes, Model } = require('sequelize');

/** This class stores receipts of toast transactions */
exports.ToastRecipient = class extends Model { }

exports.initModel = function (sequelize) {
	exports.ToastRecipient.init({
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
