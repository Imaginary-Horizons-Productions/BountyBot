const { Model, DataTypes } = require("sequelize");

exports.SeasonParticpation = class extends Model { }

exports.initModel = function (sequelize) {
	exports.SeasonParticpation.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		userId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		companyId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		seasonId: {
			type: DataTypes.UUID,
			allowNull: false
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
