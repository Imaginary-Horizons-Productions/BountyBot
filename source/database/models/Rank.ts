import { roleMention, type Collection, type Role, type Snowflake } from "discord.js";
import { DataTypes, Model, type Sequelize } from "sequelize";
import type { Database } from "..";

/** A company's Ranks include a variance threshold (difficulty to achieve) and optionally a role to give hunters and emoji for the scoreboard */
export class Rank extends Model {
	declare companyId: Snowflake;
	declare threshold: number;
	declare roleId: Snowflake | null;
	declare rankmoji: string;

	static associate(models: Database) { }

	getName(guildRoles: Collection<Snowflake, Role>, index: number) {
		if (this.roleId) {
			const role = guildRoles.get(this.roleId);
			if (role !== undefined) {
				return role.name;
			}
		}
		return `Rank ${index + 1}`;
	}

	getMention(index: number) {
		if (this.roleId) {
			return roleMention(this.roleId);
		} else {
			return `Rank ${index + 1}`;
		}
	}
}

export function initModel(sequelize: Sequelize) {
	return Rank.init({
		companyId: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		threshold: {
			primaryKey: true,
			type: DataTypes.REAL
		},
		roleId: {
			type: DataTypes.STRING
		},
		rankmoji: {
			type: DataTypes.STRING
		}
	}, {
		sequelize,
		modelName: "Rank",
		freezeTableName: true
	});
};
