const { Model, Sequelize, DataTypes } = require('sequelize');

/** A bounty hunter's Contribution to a company Goal */
class Contribution extends Model {
	static associate(models) {
		models.Contribution.User = models.Contribution.belongsTo(models.User, {
			foreignKey: "userId"
		})
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	Contribution.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		goalId: {
			type: DataTypes.UUID,
			allowNull: false
		},
		userId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		value: {
			type: DataTypes.BIGINT,
			allowNull: false
		}
	}, {
		sequelize,
		modelName: "Contribution",
		freezeTableName: true
	});
	return Contribution;
}

module.exports = { Contribution, initModel };
