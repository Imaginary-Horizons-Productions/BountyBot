import type { Snowflake } from "discord.js";
import { DataTypes, Model, type Sequelize } from "sequelize";
import type { Database } from "..";

/** This model represents a toast raised for a group of bounty hunters */
export class Toast extends Model {
	declare id: string;
	declare companyId: Snowflake;
	declare senderId: Snowflake;
	declare hostMessageId: Snowflake | null;
	declare toastMessageId: Snowflake | null;
	declare text: string;
	declare imageURL: string | null;
	declare secondings: number;
	declare createdAt: string;
	declare updatedAt: string;

	static associate(models: Database) {
		//TODONOW confirm this still works for setting up associations
		//TODONOW adapt usage in other layers
		models.Toasts.belongsTo(models.Companies, { foreignKey: "companyId" });
		models.Toasts.belongsTo(models.Users, { foreignKey: "senderId" });
		models.Toasts.hasMany(models.Recipients, { foreignKey: "toastId" });
		models.Toasts.hasMany(models.Secondings, { foreignKey: "toastId" });
	}
}

export function initModel(sequelize: Sequelize) {
	return Toast.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		companyId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		senderId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		hostMessageId: { // For reaction toasts: the id of the original message being reacted to
			type: DataTypes.STRING
		},
		toastMessageId: { // For reaction secondings: the id of the reaction toast message
			type: DataTypes.STRING
		},
		text: {
			type: DataTypes.STRING,
			allowNull: false
		},
		imageURL: {
			type: DataTypes.STRING,
		},
		secondings: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		}
	}, {
		sequelize,
		modelName: "Toast",
		freezeTableName: true
	});
}
