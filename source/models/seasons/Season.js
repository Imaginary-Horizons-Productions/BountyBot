const { Model, DataTypes, Sequelize } = require("sequelize");

exports.Season = class extends Model { }

/** @param {Sequelize} sequelize */
exports.initModel = function (sequelize) {
	exports.Season.init({
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
	})
}
