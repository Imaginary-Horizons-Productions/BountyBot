const { Model, Sequelize, DataTypes } = require('sequelize');

/** A Goal for which all bounty hunters in a company contribute to */
class Goal extends Model {
	static associate(models) {
		models.Goal.Contributions = models.Goal.hasMany(models.Contribution, {
			foreignKey: "goalId"
		})
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	return Goal.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		companyId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		state: { // "ongoing", "expired", "completed"
			type: DataTypes.STRING,
			defaultValue: "ongoing"
		},
		type: { // "bounties", "toasts", "secondings"
			type: DataTypes.STRING,
			allowNull: false
		},
		requiredGP: {
			type: DataTypes.BIGINT,
			allowNull: false
		}
	}, {
		sequelize,
		modelName: "Goal",
		freezeTableName: true
	});
}

module.exports = { Goal, initModel };
