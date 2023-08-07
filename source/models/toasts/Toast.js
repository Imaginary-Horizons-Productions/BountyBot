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
		guildId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		senderId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		recipients: {
			type: DataTypes.VIRTUAL,
			async get() {
				return await sequelize.models.ToastRecipient.findAll({ where: { toastId: this.id } });
			}
		},
		rewardedRecipients: {
			type: DataTypes.VIRTUAL,
			async get() {
				return await sequelize.models.ToastRecipient.findAll({ where: { toastId: this.id, isRewarded: true } });
			}
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
