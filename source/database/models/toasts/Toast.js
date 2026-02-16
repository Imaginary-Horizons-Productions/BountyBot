const { Model, Sequelize, DataTypes } = require('sequelize');

/** This model represents a toast raised for a group of bounty hunters */
class Toast extends Model {
	static associate(models) {
		models.Toast.Company = models.Toast.belongsTo(models.Company, {
			foreignKey: "companyId"
		});
		models.Toast.User = models.Toast.belongsTo(models.User, {
			foreignKey: "senderId"
		});
		models.Toast.Recipients = models.Toast.hasMany(models.Recipient, {
			foreignKey: "toastId"
		});
		models.Toast.Secondings = models.Toast.hasMany(models.Seconding, {
			foreignKey: "toastId"
		});
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	return Toast.init({
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
		messageId: { // For reaction toasts/secondings: the id of the original message being reacted to
			type: DataTypes.STRING
		},
		text: {
			type: DataTypes.STRING,
			allowNull: false
		},
		imageURL: {
			type: DataTypes.STRING,
		},
		secondings: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		}
	}, {
		sequelize,
		modelName: "Toast",
		freezeTableName: true
	});
}

module.exports = { Toast, initModel };
