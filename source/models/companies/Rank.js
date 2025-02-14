const { Model, Sequelize, DataTypes } = require('sequelize');

/** A company's Ranks include a variance threshold (difficulty to achieve) and optionally a role to give hunters and emoji for the scoreboard */
class Rank extends Model {
	static associate(models) { }
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	Rank.init({
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
	return Rank;
};

module.exports = { Rank, initModel };
