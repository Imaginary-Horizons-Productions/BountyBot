const { Model, Sequelize, DataTypes } = require('sequelize');

/** This class stores receipts of toast transactions */
class Recipient extends Model {
	static associate(models) {
		models.Recipient.Toast = models.Recipient.belongsTo(models.Toast, {
			foreignKey: "toastId"
		});
		models.Recipient.User = models.Recipient.belongsTo(models.User, {
			foreignKey: "recipientId"
		});
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	Recipient.init({
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
	return Recipient;
}

module.exports = { Recipient, initModel };
