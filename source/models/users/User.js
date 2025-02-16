const { Model, DataTypes, Sequelize } = require('sequelize');

/** This class stores global information for bot users */
class User extends Model {
	static associate(models) {
		models.User.Items = models.User.hasMany(models.Item, {
			foreignKey: "userId"
		})
		models.User.Completions = models.User.hasMany(models.Completion, {
			foreignKey: "userId"
		});
		models.User.Toasts = models.User.hasMany(models.Toast, {
			foreignKey: "senderId"
		});
		models.User.Recipients = models.User.hasMany(models.Recipient, {
			foreignKey: "recipientId"
		});
		models.User.Secondings = models.User.hasMany(models.Seconding, {
			foreignKey: "seconderId"
		});
		models.User.Participations = models.User.hasMany(models.Participation, {
			foreignKey: "userId"
		})
		models.User.Contributions = models.User.hasMany(models.Contribution, {
			foreignKey: "userId"
		})
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	User.init({
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
	return User;
}

module.exports = { User, initModel };
