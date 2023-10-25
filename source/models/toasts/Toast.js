const { DataTypes, Model } = require('sequelize');

/** This model represents a toast raised for a group of bounty hunters */
exports.Toast = class extends Model { }

exports.initModel = function (sequelize) {
	exports.Toast.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		companyId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		senderId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		text: {
			type: DataTypes.STRING,
			allowNull: false
		},
		imageURL: {
			type: DataTypes.STRING,
		}
	}, {
		sequelize,
		modelName: 'Toast',
		freezeTableName: true
	});
}
