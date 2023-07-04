const { DataTypes: { STRING, REAL }, Model } = require('sequelize');

/** Ranks, individual per guild, include a variance threshold (difficulty to achieve) and optionally a role to give hunters and emoji for the scoreboard */
const guildRankModel = {
	guildId: {
		primaryKey: true,
		type: STRING,
		allowNull: false,
		references: {
			model: 'Guild'
		}
	},
	varianceThreshold: {
		primaryKey: true,
		type: REAL,
		allowNull: false
	},
	roleId: {
		type: STRING
	},
	rankMoji: {
		type: STRING
	}
};
exports.GuildRank = class GuildRank extends Model { }

exports.initModel = function (sequelize) {
	exports.GuildRank.init(guildRankModel, {
		sequelize,
		modelName: 'GuildRank',
		freezeTableName: true
	});
}
