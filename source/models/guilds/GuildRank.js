const { DataTypes, Model } = require('sequelize');

/** Ranks, individual per guild, include a variance threshold (difficulty to achieve) and optionally a role to give hunters and emoji for the scoreboard */
exports.GuildRank = class extends Model { }

exports.initModel = function (sequelize) {
	exports.GuildRank.init({
		guildId: {
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
		modelName: 'GuildRank',
		freezeTableName: true
	});
}
