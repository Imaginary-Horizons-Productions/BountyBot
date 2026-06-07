import type { GuildScheduledEventManager, Snowflake } from "discord.js";
import { DataTypes, Model, type Sequelize } from "sequelize";
import type { Database } from "..";

/** Bounties are user created objectives for other server members to complete */
export class Bounty extends Model {
	declare id: string;
	declare userId: Snowflake;
	declare companyId: Snowflake;
	declare postingId: Snowflake | null;
	declare slotNumber: number;
	declare isEvergreen: boolean;
	declare title: string;
	declare thumbnailURL: string | null;
	declare description: string | null;
	declare attachmentURL: string | null;
	declare scheduledEventId: string | null;
	declare state: "open" | "completed" | "deleted";
	declare showcaseCount: number;
	declare completedAt: string;
	declare editCount: number;
	declare createdAt: string; //TODONOW are these really strings?
	declare updatedAt: string;

	static associate(models: Database) {
		models.Bounties.hasMany(models.Completions, { foreignKey: "bountyId" });
	}

	static calculateCompleterReward(posterLevel: number, slotNumber: number, showcaseCount: number) {
		const showcaseMultiplier = 0.25 * showcaseCount + 1;
		return Math.max(2, Math.floor((6 + 0.5 * posterLevel - 3 * slotNumber + 0.5 * slotNumber % 2) * showcaseMultiplier));
	}

	calculatePosterReward(hunterCount: number) {
		let posterXP = Math.ceil(hunterCount / 2);
		for (const property of ["description", "thumbnailURL", "attachmentURL", "scheduledEventId"] as (keyof Bounty)[]) {
			if (this[property] !== null) {
				posterXP++;
			}
		}
		return posterXP;
	}

	getScheduledEvent(guildScheduledEventManager: GuildScheduledEventManager) {
		if (!this.scheduledEventId) {
			return null;
		}

		return guildScheduledEventManager.fetch(this.scheduledEventId);
	}
}

export function initModel(sequelize: Sequelize) {
	return Bounty.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		userId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		companyId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		postingId: {
			type: DataTypes.STRING
		},
		slotNumber: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		isEvergreen: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		},
		title: {
			type: DataTypes.STRING,
			allowNull: false
		},
		thumbnailURL: {
			type: DataTypes.STRING
		},
		description: {
			type: DataTypes.STRING
		},
		attachmentURL: {
			type: DataTypes.STRING
		},
		scheduledEventId: {
			type: DataTypes.STRING
		},
		state: {
			type: DataTypes.STRING,
			defaultValue: "open" //TODONOW create enum
		},
		showcaseCount: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		completedAt: {
			type: DataTypes.DATE
		},
		editCount: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		}
	}, {
		sequelize,
		modelName: "Bounty",
		freezeTableName: true
	});
};
