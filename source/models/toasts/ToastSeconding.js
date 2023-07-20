const { DataTypes, Model } = require('sequelize');

/** This class stores receipts of a toast seconding */
exports.ToastSeconding = class extends Model { }

exports.initModel = function (sequelize) {
	exports.ToastSeconding.init({
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
