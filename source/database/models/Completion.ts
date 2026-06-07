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

	static associate(models: Database) {
		models.Completions.belongsTo(models.Bounties, { foreignKey: "bountyId" });
		models.Completions.belongsTo(models.Users, { foreignKey: "userId" });
		models.Completions.belongsTo(models.Companies, { foreignKey: "companyId" });
	}
}

export function initModel(sequelize: Sequelize) {
	return Completion.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		bountyId: { // TODONOW should be non-nullable?
			type: DataTypes.UUID
		},
		userId: { // TODONOW should be non-nullable?
			type: DataTypes.STRING
		},
		companyId: { // TODONOW should be non-nullable?
			type: DataTypes.STRING
		},
		xpAwarded: { //TODONOW default to 0?
			type: DataTypes.INTEGER
		}
	}, {
		sequelize,
		modelName: "Completion",
		freezeTableName: true
	});
};
