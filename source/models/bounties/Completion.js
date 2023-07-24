const { DataTypes, Model } = require('sequelize');

/** Store receipt information of a bounty completion and relevant stats of that bounty */
exports.Completion = class extends Model { }

exports.initModel = function (sequelize) {
	exports.Completion.init({
		bountyId: {
			primaryKey: true,
			type: DataTypes.BIGINT
		},
		userId: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		guildId: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		xpAwarded: {
			type: DataTypes.INTEGER
		}
	}, {
		sequelize,
		modelName: 'Completion',
		freezeTableName: true
	});
}
