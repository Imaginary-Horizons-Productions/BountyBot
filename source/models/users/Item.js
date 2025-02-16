const { Model, Sequelize, DataTypes } = require('sequelize');

/** This class stores global information for user items */
class Item extends Model {
	static associate(models) { }
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	Item.init({
		userId: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		itemName: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		count: {
			type: DataTypes.BIGINT,
			defaultValue: 1
		}
	}, {
		sequelize,
		modelName: "Item",
		freezeTableName: true
	});
	return Item;
};

module.exports = { Item, initModel };
