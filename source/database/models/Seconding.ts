import type { Snowflake } from "discord.js";
import { DataTypes, Model, type Sequelize } from "sequelize";
import type { Database } from "..";

/** This class stores receipts of a toast seconding */
export class Seconding extends Model {
	declare toastId: string;
	declare seconderId: Snowflake;
	declare wasCrit: boolean;
	declare createdAt: string;
	declare updatedAt: string;

	static associate(models: Database) {
		models.Secondings.belongsTo(models.Toasts, { foreignKey: "toastId" });
		models.Secondings.belongsTo(models.Users, { foreignKey: "seconderId" });
	}
}

export function initModel(sequelize: Sequelize) {
	return Seconding.init({
		toastId: {
			primaryKey: true,
			type: DataTypes.BIGINT
		},
		seconderId: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		wasCrit: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		}
	}, {
		sequelize,
		modelName: "Seconding",
		freezeTableName: true
	});
}
