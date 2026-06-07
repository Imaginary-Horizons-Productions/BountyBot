import type { Snowflake } from "discord.js";
import { DataTypes, Model, type Sequelize } from "sequelize";
import type { Database } from "..";

export class Season extends Model {
	declare id: string;
	declare companyId: Snowflake;
	declare isCurrentSeason: boolean;
	declare isPreviousSeason: boolean;
	declare totalXP: Promise<number>;
	declare bountiesCompleted: number;
	declare toastsRaised: number;

	static associate(models: Database) {
		models.Seasons.hasMany(models.Participations, { foreignKey: "seasonId" });
	}
}

export function initModel(sequelize: Sequelize) {
	return Season.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		companyId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		isCurrentSeason: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		},
		isPreviousSeason: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
		},
		totalXP: {
			type: DataTypes.VIRTUAL,
			async get() {
				return await sequelize.models.Participation.sum("xp", { where: { seasonId: this.id } }) ?? 0;
			}
		},
		bountiesCompleted: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		toastsRaised: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		}
	}, {
		sequelize,
		modelName: "Season",
		freezeTableName: true
	});
}
