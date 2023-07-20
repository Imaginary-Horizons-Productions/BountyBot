const { DataTypes, Model } = require('sequelize');

/** This class stores global information for bot users */
exports.User = class extends Model { }

exports.initModel = function (sequelize) {
	exports.User.init({
		id: {
			primaryKey: true,
			type: DataTypes.STRING,
			allowNull: false
		},
		isPremium: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		}
	}, {
		sequelize,
		modelName: 'User',
		freezeTableName: true
	});
}
