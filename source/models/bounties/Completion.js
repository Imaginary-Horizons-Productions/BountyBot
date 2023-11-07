const { DataTypes, Model, Sequelize } = require('sequelize');

/** Store receipt information of a bounty completion and relevant stats of that bounty */
exports.Completion = class extends Model { }

/** @param {Sequelize} sequelize */
exports.initModel = function (sequelize) {
	exports.Completion.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		bountyId: {
			type: DataTypes.BIGINT
		},
		userId: {
			type: DataTypes.STRING
		},
		companyId: {
			type: DataTypes.STRING
		},
		xpAwarded: {
			type: DataTypes.INTEGER
		}
	}, {
		sequelize,
		modelName: "Completion",
		freezeTableName: true
	});
}
