const { DataTypes, Model } = require('sequelize');

/** A company's Ranks include a variance threshold (difficulty to achieve) and optionally a role to give hunters and emoji for the scoreboard */
exports.CompanyRank = class extends Model { }

exports.initModel = function (sequelize) {
	exports.CompanyRank.init({
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
		modelName: "CompanyRank",
		freezeTableName: true
	});
}
