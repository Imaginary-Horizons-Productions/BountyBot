import type { Snowflake } from "discord.js";
import { DataTypes, Model, type Sequelize } from "sequelize";
import type { Database } from "..";

/** A bounty hunter's Contribution to a company Goal */
export class Contribution extends Model {
	declare id: string;
	declare goalId: string;
	declare userId: Snowflake;
	declare value: number;
}

export function initModel(sequelize: Sequelize) {
	return Contribution.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		goalId: {
			type: DataTypes.UUID,
			allowNull: false
		},
		userId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		value: {
			type: DataTypes.BIGINT,
			allowNull: false
		}
	}, {
		sequelize,
		modelName: "Contribution",
		freezeTableName: true
	});
}

export function associate(models: Database) {
	models.Contributions.belongsTo(models.Users, { foreignKey: "userId" });
}
