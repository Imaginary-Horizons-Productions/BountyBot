const { Model, DataTypes } = require("sequelize");

exports.SeasonParticpation = class extends Model { }

exports.initModel = function (sequelize) {
	exports.SeasonParticpation.init({
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
		}
	}, {
		sequelize,
		modelName: "SeasonParticipation",
		freezeTableName: true
	})
}
