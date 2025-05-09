const { Model, Sequelize, DataTypes } = require('sequelize');

class Season extends Model {
	static associate(models) {
		models.Season.Participations = models.Season.hasMany(models.Participation, {
			foreignKey: "seasonId"
		})
	}

	static calculateXPMean(participations) {
		if (participations.length < 1) {
			return null;
		}
		const totalXP = participations.reduce((total, particpation) => total + particpation.xp, 0);
		return totalXP / participations.length;
	}

	/**
	 *
	 * @param {Participation[]} participations
	 */
	static calculateXPStandardDeviation(participations) {
		if (participations.length < 1) {
			return null;
		}
		const mean = Season.calculateXPMean(participations);
		return Math.sqrt(participations.reduce((total, particpation) => total + (particpation.xp - mean) ** 2, 0) / participations.length);
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	return Season.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		companyId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		isCurrentSeason: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		},
		isPreviousSeason: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
		},
		xpMean: { //TODONOW does this really need to be cached?
			type: DataTypes.DOUBLE
		},
		xpStandardDeviation: { //TODONOW does this really need to be cached?
			type: DataTypes.DOUBLE
		},
		totalXP: {
			type: DataTypes.VIRTUAL,
			async get() {
				return await sequelize.models.Participation.sum("xp", { where: { seasonId: this.id } }) ?? 0;
			}
		},
		bountiesCompleted: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		toastsRaised: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		}
	}, {
		sequelize,
		modelName: "Season",
		freezeTableName: true
	});
}

module.exports = { Season, initModel };
