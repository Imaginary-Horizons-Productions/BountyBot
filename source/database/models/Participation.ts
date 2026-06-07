import type { Snowflake } from "discord.js";
import { DataTypes, Model, type Sequelize } from "sequelize";
import type { Database } from "..";
import type { Hunter } from "./Hunter";

export class Participation extends Model {
	declare userId: Snowflake;
	declare companyId: Snowflake;
	declare seasonId: string;
	declare hunter: Promise<Hunter>;
	declare isRankDisqualified: boolean;
	declare xp: number;
	declare placement: number;
	declare rankIndex: number | null;
	declare postingsComplete: number;
	declare toastsRaised: number;
	declare goalContributions: number;
	declare dqCount: number;

	static associate(models: Database) {
		models.Participations.belongsTo(models.Users, { foreignKey: "userId" });
		models.Participations.belongsTo(models.Companies, { foreignKey: "companyId" });
	}
}

export function initModel(sequelize: Sequelize) {
	return Participation.init({
		userId: {
			primaryKey: true,
			type: DataTypes.STRING,
			allowNull: false
		},
		companyId: {
			primaryKey: true,
			type: DataTypes.STRING,
			allowNull: false
		},
		seasonId: {
			primaryKey: true,
			type: DataTypes.UUID,
			allowNull: false
		},
		hunter: { //TODONOW convert to association
			type: DataTypes.VIRTUAL,
			async get() {
				return await sequelize.models.Hunter.findOne({ where: { userId: this.userId, companyId: this.companyId } });
			}
		},
		isRankDisqualified: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		},
		xp: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		placement: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		rankIndex: {
			type: DataTypes.INTEGER
		},
		postingsCompleted: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		toastsRaised: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		goalContributions: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		dqCount: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		}
	}, {
		sequelize,
		modelName: "Participation",
		freezeTableName: true
	});
}
