import type { Snowflake } from "discord.js";
import { DataTypes, Model, type Sequelize } from "sequelize";
import type { Database } from "..";

/** A Goal for which all bounty hunters in a company contribute to */
export class Goal extends Model {
	declare id: string;
	declare companyId: Snowflake;
	declare state: "ongoing" | "expired" | "completed";
	declare type: "bounties" | "toasts" | "secondings";
	declare requiredGP: number;
}

export function initModel(sequelize: Sequelize) {
	return Goal.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		companyId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		state: {
			type: DataTypes.STRING,
			defaultValue: "ongoing"
		},
		type: {
			type: DataTypes.STRING,
			allowNull: false
		},
		requiredGP: {
			type: DataTypes.BIGINT,
			allowNull: false
		}
	}, {
		sequelize,
		modelName: "Goal",
		freezeTableName: true
	});
}

export function associate(models: Database) {
	models.Goals.hasMany(models.Contributions, { foreignKey: "goalId" });
}
