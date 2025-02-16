const { Model, Sequelize, DataTypes } = require('sequelize');

/** Store receipt information of a bounty completion and relevant stats of that bounty */
class Completion extends Model {
	static associate(models) {
		models.Completion.Bounty = models.Completion.belongsTo(models.Bounty, {
			foreignKey: "bountyId"
		});
		models.Completion.User = models.Completion.belongsTo(models.User, {
			foreignKey: "userId"
		});
		models.Completion.Company = models.Completion.belongsTo(models.Company, {
			foreignKey: "companyId"
		});
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	Completion.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		bountyId: {
			type: DataTypes.UUID
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
	return Completion;
};

module.exports = { Completion, initModel };
