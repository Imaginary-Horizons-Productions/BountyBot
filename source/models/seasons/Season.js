const { Model, Sequelize, DataTypes } = require('sequelize');

class Season extends Model {
	static associate(models) {
		models.Season.Participations = models.Season.hasMany(models.Participation, {
			foreignKey: "seasonId"
		})
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	Season.init({
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
		freezeTableName: true,
		paranoid: true
	});
	return Season;
}

module.exports = { Season, initModel };
