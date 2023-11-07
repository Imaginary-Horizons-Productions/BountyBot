const { DataTypes, Model, Sequelize } = require('sequelize');

/** This class stores global information for bot users */
exports.User = class extends Model { }

/** @param {Sequelize} sequelize */
exports.initModel = function (sequelize) {
	exports.User.init({
		id: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		isPremium: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		}
	}, {
		sequelize,
		modelName: "User",
		freezeTableName: true
	});
}
