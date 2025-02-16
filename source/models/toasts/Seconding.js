const { Model, Sequelize, DataTypes } = require('sequelize');

/** This class stores receipts of a toast seconding */
class Seconding extends Model {
	static associate(models) {
		models.Seconding.Toast = models.Seconding.belongsTo(models.Toast, {
			foreignKey: "toastId"
		});
		models.Seconding.User = models.Seconding.belongsTo(models.User, {
			foreignKey: "seconderId"
		});
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	Seconding.init({
		toastId: {
			primaryKey: true,
			type: DataTypes.BIGINT
		},
		seconderId: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		wasCrit: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		}
	}, {
		sequelize,
		modelName: "Seconding",
		freezeTableName: true
	});
	return Seconding;
}

module.exports = { Seconding, initModel };
