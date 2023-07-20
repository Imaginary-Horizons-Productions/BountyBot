const { DataTypes, Model } = require('sequelize');

/** This model represents a toast raised for a group of bounty hunters */
exports.Toast = class extends Model { }

exports.initModel = function (sequelize) {
	exports.Toast.init({
		id: {
			primaryKey: true,
			type: DataTypes.BIGINT,
			autoIncrement: true
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
		seconders: {
			type: DataTypes.VIRTUAL,
			async get() {
				return await sequelize.models.ToastSeconding.findAll({ where: { toastId: this.id } });
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
