const { Model, Sequelize, DataTypes } = require('sequelize');
const { Season } = require('./Season');

class Participation extends Model {
	static associate(models) {
		models.Participation.User = models.Participation.belongsTo(models.User, {
			foreignKey: "userId"
		})
		models.Participation.Company = models.Participation.belongsTo(models.Company, {
			foreignKey: "companyId"
		})
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	return Participation.init({
		userId: {
			primaryKey: true,
			type: DataTypes.STRING,
			allowNull: false
		},
		companyId: {
			primaryKey: true,
			type: DataTypes.STRING,
			allowNull: false
		},
		seasonId: {
			primaryKey: true,
			type: DataTypes.UUID,
			allowNull: false
		},
		hunter: {
			type: DataTypes.VIRTUAL,
			async get() {
				return await sequelize.models.Hunter.findOne({ where: { userId: this.userId, companyId: this.companyId } });
			}
		},
		isRankDisqualified: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		},
		xp: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		placement: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		rankIndex: {
			type: DataTypes.INTEGER
		},
		postingsCompleted: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		toastsRaised: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		goalContributions: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		dqCount: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		}
	}, {
		sequelize,
		modelName: "Participation",
		freezeTableName: true
	});
}

module.exports = { Participation, initModel };
