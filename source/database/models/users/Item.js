const { Model, Sequelize, DataTypes } = require('sequelize');

/** This class stores global information for user items */
class Item extends Model {
	static associate(models) { }
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	return Item.init({
		id: {
			primaryKey: true,
			type: DataTypes.INTEGER,
			autoIncrement: true
		},
		userId: {
			type: DataTypes.STRING,
			allowNull: false,
			references: {
				model: 'User',
				key: 'id'
			}
		},
		itemName: {
			type: DataTypes.STRING,
			allowNull: false
		},
		used: {
			type: DataTypes.BOOLEAN,
			default: false
		}
	}, {
		sequelize,
		modelName: "Item",
		freezeTableName: true
	});
};

module.exports = { Item, initModel };
