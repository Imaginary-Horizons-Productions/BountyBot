import type { Snowflake } from "discord.js";
import { type Sequelize, DataTypes, Model } from "sequelize";
import type { Database } from "..";

/** This class stores global information for bot users */
export class UserInteraction extends Model {
	declare userId: Snowflake;
	declare interactionName: string;
	declare interactionTime: Date;
	declare lastInteractTime: Date;
	declare cooldownTime: Date;
	declare createdAt: Date;
	declare updatedAt: Date;
}

export function initModel(sequelize: Sequelize) {
	return UserInteraction.init({
		userId: {
			primaryKey: true,
			type: DataTypes.STRING,
			allowNull: false
		},
		interactionName: {
			primaryKey: true,
			type: DataTypes.STRING,
			allowNull: false
		},
		interactionTime: {
			type: DataTypes.DATE,
			allowNull: false
		},
		lastInteractTime: {
			type: DataTypes.DATE,
			allowNull: false
		},
		cooldownTime: {
			type: DataTypes.DATE,
			allowNull: false
		}
	}, {
		sequelize,
		modelName: "UserInteraction",
		freezeTableName: true,
		timestamps: false
	});
}

export function associate(models: Database) {
	models.UserInteractions.hasOne(models.Users, { foreignKey: "id" });
}
