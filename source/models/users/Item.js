const { DataTypes, Model, Sequelize } = require('sequelize');

/** This class stores global information for user items */
exports.Item = class extends Model { }

/** @param {Sequelize} sequelize */
exports.initModel = function (sequelize) {
	exports.Item.init({
		userId: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		itemName: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		count: {
			type: DataTypes.BIGINT,
			defaultValue: 1
		}
	}, {
		sequelize,
		modelName: "Item",
		freezeTableName: true
	});
}
