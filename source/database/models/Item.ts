import type { Snowflake } from "discord.js";
import { DataTypes, Model, type Sequelize } from "sequelize";
import { Database } from "..";

/** This class stores global information for user items */
export class Item extends Model {
	declare id: string;
	declare userId: Snowflake;
	declare itemName: string;
	declare used: boolean;
}

export function initModel(sequelize: Sequelize) {
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
			defaultValue: false
		}
	}, {
		sequelize,
		modelName: "Item",
		freezeTableName: true
	});
};

export function associate(models: Database) { }
