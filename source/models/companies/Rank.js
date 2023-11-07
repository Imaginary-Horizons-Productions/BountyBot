const { DataTypes, Model, Sequelize } = require('sequelize');

/** A company's Ranks include a variance threshold (difficulty to achieve) and optionally a role to give hunters and emoji for the scoreboard */
exports.Rank = class extends Model { }

/** @param {Sequelize} sequelize */
exports.initModel = function (sequelize) {
	exports.Rank.init({
		companyId: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		varianceThreshold: {
			primaryKey: true,
			type: DataTypes.REAL
		},
		roleId: {
			type: DataTypes.STRING
		},
		rankmoji: {
			type: DataTypes.STRING
		}
	}, {
		sequelize,
		modelName: "Rank",
		freezeTableName: true
	});
}
