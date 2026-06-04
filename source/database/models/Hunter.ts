import { Snowflake } from "discord.js";
import { type Sequelize, DataTypes, Model } from "sequelize";
import { Database } from "..";
import { Bounty } from './Bounty';

/** This class stores a user's information related to a specific company */
export class Hunter extends Model {
	declare userId: Snowflake;
	declare companyId: Snowflake;
	declare xp: number;
	declare lastShowcaseTimestamp: string | null;
	declare mineFinished: number;
	declare othersFinished: number;
	declare toastsRaised: number;
	declare toastsSeconded: number;
	declare toastsReceived: number;
	declare goalsInitiated: number;
	declare goalContributions: number;
	declare isBanned: boolean;
	declare hasBeenBanned: boolean;
	declare penaltyCount: number;
	declare penaltyPointTotal: number;
	declare profileColor: string;
	declare itemFindBoost: boolean;
	declare createdAt: string;
	declare updatedAt: string;

	static associate(models: Database) {
		models.Hunters.belongsTo(models.Users, { foreignKey: "userId" });
	}

	static xpThreshold(level: number, xpCoefficient: number) {
		// xp = xpCoefficient*(level - 1)^2
		return xpCoefficient * (level - 1) ** 2;
	}

	static getBountySlotCount(level: number, maxSimBounties: number) {
		let slots = 1 + Math.floor(level / 12) * 2;
		let remainder = level % 12;
		if (remainder >= 3) {
			slots++;
			remainder -= 3;
		}
		if (remainder >= 7) {
			slots++;
		}
		return Math.min(slots, maxSimBounties);
	}

	static getLevelUpRewards(level: number, maxSlots: number) {
		const rewards: [kind: "bountySlotUnlocked" | "oddSlotBaseRewardIncrease" | "evenSlotBaseRewardIncrease", value: number][] = [];
		const currentSlots = Hunter.getBountySlotCount(level, maxSlots);
		if (currentSlots < maxSlots) {
			if (level == 3 + 12 * Math.floor((currentSlots - 2) / 2) + 7 * ((currentSlots - 2) % 2)) {
				rewards.push(["bountySlotUnlocked", currentSlots]);
			};
		}
		if (level % 2) {
			rewards.push(["oddSlotBaseRewardIncrease", Bounty.calculateCompleterReward(level, 1, 0)]);
		} else {
			rewards.push(["evenSlotBaseRewardIncrease", Bounty.calculateCompleterReward(level, 2, 0)]);
		}
		return rewards;
	}

	getLevel(xpCoefficient: number) {
		return Math.floor(Math.sqrt(this.xp / xpCoefficient) + 1);
	}
}

export function initModel(sequelize: Sequelize) {
	return Hunter.init({
		userId: {
			primaryKey: true,
			type: DataTypes.STRING,
		},
		companyId: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		xp: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		lastShowcaseTimestamp: {
			type: DataTypes.DATE
		},
		mineFinished: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		othersFinished: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		toastsRaised: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		toastsSeconded: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		toastsReceived: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		goalsInitiated: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		goalContributions: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		isBanned: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		},
		hasBeenBanned: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		},
		penaltyCount: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		penaltyPointTotal: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		profileColor: {
			type: DataTypes.STRING,
			defaultValue: "Default"
		},
		itemFindBoost: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		}
	}, {
		sequelize,
		modelName: "Hunter",
		freezeTableName: true
	});
};
