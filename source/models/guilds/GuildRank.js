const { DataTypes, Model } = require('sequelize');

/** Ranks, individual per guild, include a variance threshold (difficulty to achieve) and optionally a role to give hunters and emoji for the scoreboard */
exports.GuildRank = class extends Model { }

exports.initModel = function (sequelize) {
	exports.GuildRank.init({
		varianceThreshold: {
			primaryKey: true,
			type: DataTypes.REAL,
			allowNull: false
		},
		roleId: {
			type: DataTypes.STRING
		},
		rankMoji: {
			type: DataTypes.STRING
		}
	}, {
		sequelize,
		modelName: 'GuildRank',
		freezeTableName: true
	});
}
