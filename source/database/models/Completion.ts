import type { Snowflake } from "discord.js";
import { type Sequelize, DataTypes, Model } from "sequelize";
import type { Database } from "..";

/** Store receipt information of a bounty completion and relevant stats of that bounty */
export class Completion extends Model {
	declare id: string;
	declare bountyId: string | null;
	declare userId: Snowflake | null;
	declare companyId: Snowflake | null;
	declare xpAwarded: number | null;
}

export function initModel(sequelize: Sequelize) {
	return Completion.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		bountyId: {
			type: DataTypes.UUID
		},
		userId: {
			type: DataTypes.STRING
		},
		companyId: {
			type: DataTypes.STRING
		},
		xpAwarded: {
			type: DataTypes.INTEGER
		}
	}, {
		sequelize,
		modelName: "Completion",
		freezeTableName: true
	});
};

export function associate(models: Database) {
	models.Completions.belongsTo(models.Bounties, { foreignKey: "bountyId" });
	models.Completions.belongsTo(models.Users, { foreignKey: "userId" });
	models.Completions.belongsTo(models.Companies, { foreignKey: "companyId" });
}
