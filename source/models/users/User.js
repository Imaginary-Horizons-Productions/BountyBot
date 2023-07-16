const { DataTypes: { STRING, BOOLEAN }, Model } = require('sequelize');

/** This class stores global information for bot users */
const userModel = {
	id: {
		primaryKey: true,
		type: STRING,
		allowNull: false
	},
	isPremium: {
		type: BOOLEAN,
		defaultValue: false
	}
};
exports.User = class User extends Model { }

exports.initModel = function (sequelize) {
	exports.User.init(userModel, {
		sequelize,
		modelName: 'User',
		freezeTableName: true
	});
}
