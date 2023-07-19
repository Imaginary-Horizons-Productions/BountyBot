const { DataTypes, Model } = require('sequelize');

/** This class stores receipts of a toast seconding */
exports.ToastSeconding = class ToastSeconding extends Model { }

exports.initModel = function (sequelize) {
	exports.ToastSeconding.init({
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
		modelName: 'ToastSeconding',
		freezeTableName: true
	});
}
