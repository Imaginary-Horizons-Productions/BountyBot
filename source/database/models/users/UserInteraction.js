const { Model, DataTypes, Sequelize } = require('sequelize');

/** This class stores global information for bot users */
class UserInteraction extends Model {
	static associate(models) {
		models.UserInteraction.User = models.User.hasOne(models.User, {
			foreignKey: "userId"
		})
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	return UserInteraction.init({
		userId: {
			primaryKey: true,
			type: DataTypes.STRING,
			allowNull: false
		},
		interactionName: {
			primaryKey: true,
			type: DataTypes.STRING,
			allowNull: false
		},
		interactionTime: {
			type: DataTypes.DATE
		},
		lastInteractTime: {
			type: DataTypes.DATE
		},
		cooldownTime: {
			type: DataTypes.DATE
		}
	}, {
		sequelize,
		modelName: "UserInteraction",
		freezeTableName: true,
		timestamps: false
	});
}

module.exports = { UserInteraction, initModel };
