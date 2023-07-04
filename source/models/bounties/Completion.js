// Database Entity Class
const { DataTypes: { BIGINT, STRING }, Model } = require('sequelize');

// Store receipt information of a bounty completion and relevant stats of that bounty
const completionModel = {
	bountyId: {
		primaryKey: true,
		type: BIGINT,
		references: {
			model: 'Bounty',
			key: 'id'
		}
	},
	userId: {
		primaryKey: true,
		type: STRING,
		references: {
			model: 'User',
			key: 'id'
		}
	},
	guildId: {
		primaryKey: true,
		type: STRING,
		references: {
			model: 'Guild',
			key: 'id'
		}
	}
};
exports.Completion = class Completion extends Model { }

exports.initModel = function (sequelize) {
	exports.Completion.init(completionModel, {
		sequelize,
		modelName: 'Completion',
		freezeTableName: true
	});
}
