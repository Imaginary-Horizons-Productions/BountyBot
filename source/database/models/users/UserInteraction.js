const { Model, DataTypes, Sequelize } = require('sequelize');

/** This class stores global information for bot users */
class UserInteraction extends Model {
	static associate(models) {
		models.UserInteraction.User = models.UserInteraction.hasOne(models.User, {
			foreignKey: "id"
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
			type: DataTypes.DATE,
			allowNull: false
		},
		lastInteractTime: {
			type: DataTypes.DATE,
			allowNull: false
		},
		cooldownTime: {
			type: DataTypes.DATE,
			allowNull: false
		}
	}, {
		sequelize,
		modelName: "UserInteraction",
		freezeTableName: true,
		timestamps: false
	});
}

module.exports = { UserInteraction, initModel };
