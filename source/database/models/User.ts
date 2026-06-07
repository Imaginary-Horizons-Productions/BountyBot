import type { Snowflake } from "discord.js";
import { DataTypes, Model, type Sequelize } from "sequelize";
import type { Database } from "..";

/** This class stores global information for bot users */
export class User extends Model {
	declare id: Snowflake;
	declare isPremium: boolean;
	declare createdAt: string;
	declare updatedAt: string;

	static associate(models: Database) {
		User.hasMany(models.Items, { foreignKey: "userId" });
		User.hasMany(models.Completions, { foreignKey: "userId" });
		User.hasMany(models.Toasts, { foreignKey: "senderId" });
		User.hasMany(models.Recipients, { foreignKey: "recipientId" });
		User.hasMany(models.Secondings, { foreignKey: "seconderId" });
		User.hasMany(models.Participations, { foreignKey: "userId" });
		User.hasMany(models.Contributions, { foreignKey: "userId" });
		User.hasMany(models.UserInteractions, { foreignKey: "userId" });
	}
}

export function initModel(sequelize: Sequelize) {
	return User.init({
		id: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		isPremium: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		}
	}, {
		sequelize,
		modelName: "User",
		freezeTableName: true
	});
}
