import type { Snowflake } from 'discord.js';
import { DataTypes, Model, type Sequelize } from 'sequelize';
import type { Database } from '..';

/** This class stores receipts of toast transactions */
export class Recipient extends Model {
	declare toastId: string;
	declare recipientId: Snowflake;
	declare isRewarded: boolean;
	declare wasCrit: boolean;
}

export function initModel(sequelize: Sequelize) {
	return Recipient.init({
		toastId: {
			primaryKey: true,
			type: DataTypes.BIGINT
		},
		recipientId: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		isRewarded: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		wasCrit: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		}
	}, {
		sequelize,
		modelName: "Recipient",
		freezeTableName: true
	});
}

export function associate(models: Database) {
	models.Recipients.belongsTo(models.Toasts, { foreignKey: "toastId" });
	models.Recipients.belongsTo(models.Users, { foreignKey: "recipientId" });
}
