import { italic, type Snowflake } from "discord.js";
import { DataTypes, Model, type Sequelize } from "sequelize";
import { MAX_BOT_NICKNAME_LENGTH } from "../../shared/constants.ts";
import type { Database } from "../index.ts";
import type { Hunter } from "./Hunter.js";

/** A Company of bounty hunters contains a Discord Guild's information and settings */
export class Company extends Model {
	declare id: Snowflake;
	declare announcementPrefix: "@here" | "@everyone" | "@silent" | "";
	declare maxSimBounties: number;
	declare backupTimer: number;
	declare nickname: string | null;
	declare xpFestivalMultiplier: number;
	declare gpFestivalMultiplier: number;
	declare disableReactionToasts: boolean;
	declare xpCoefficient: number;
	declare bountyBoardId: string | null;
	declare bountyBoardOpenTagId: string | null;
	declare bountyBoardCompletedTagId: string | null;
	declare evergreenThreadId: string | null;
	declare scoreboardChannelId: string | null;
	declare scoreboardMessageId: string | null;
	declare scoreboardIsSeasonal: boolean | null;
	declare nextRaffleString: string | null;
	declare toastThumbnailURL: string;
	declare openBountyThumbnailURL: string;
	declare completedBountyThumbnailURL: string;
	declare deletedBountyThumbnailURL: string;
	declare scoreboardThumbnailURL: string;
	declare goalCompletionThumbnailURL: string;
	declare raffleThumbnailURL: string;
	declare createdAt: string;
	declare updatedAt: string;

	static getLevel(xp: number) {
		return Math.floor(Math.sqrt(xp / 3) + 1);
	}

	getXP(hunterMap: Map<string, Hunter>) {
		let xp = 0;
		for (const hunter of hunterMap.values()) {
			xp += hunter.getLevel(this.xpCoefficient);
		}
		return xp;
	}

	festivalMultiplierString(kind: "xp" | "gp") {
		switch (kind) {
			case 'xp':
				if (this.xpFestivalMultiplier != 1) {
					return ` ${italic(`x${this.xpFestivalMultiplier}`)}`;
				} else {
					return "";
				}
			case 'gp':
				if (this.gpFestivalMultiplier != 1) {
					return ` ${italic(`x${this.gpFestivalMultiplier}`)}`;
				} else {
					return "";
				}
		}
	}
}

export function initModel(sequelize: Sequelize) {
	return Company.init({
		id: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		announcementPrefix: {
			type: DataTypes.STRING,
			defaultValue: '@here'
		},
		maxSimBounties: {
			type: DataTypes.INTEGER,
			defaultValue: 5
		},
		backupTimer: {
			type: DataTypes.BIGINT,
			defaultValue: 3600000
		},
		nickname: { // Let managers save a nickname for BountyBot for constructing festival tags
			type: DataTypes.STRING(MAX_BOT_NICKNAME_LENGTH)
		},
		xpFestivalMultiplier: {
			type: DataTypes.REAL,
			defaultValue: 1
		},
		gpFestivalMultiplier: {
			type: DataTypes.REAL,
			defaultValue: 1
		},
		disableReactionToasts: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		},
		xpCoefficient: {
			type: DataTypes.INTEGER,
			defaultValue: 3
		},
		bountyBoardId: {
			type: DataTypes.STRING
		},
		bountyBoardOpenTagId: {
			type: DataTypes.STRING
		},
		bountyBoardCompletedTagId: {
			type: DataTypes.STRING
		},
		evergreenThreadId: {
			type: DataTypes.STRING
		},
		scoreboardChannelId: {
			type: DataTypes.STRING
		},
		scoreboardMessageId: {
			type: DataTypes.STRING
		},
		scoreboardIsSeasonal: {
			type: DataTypes.BOOLEAN
		},
		nextRaffleString: {
			type: DataTypes.STRING
		},
		toastThumbnailURL: {
			type: DataTypes.STRING,
			get() {
				return this.getDataValue("toastThumbnailURL") ?? 'https://cdn.discordapp.com/attachments/545684759276421120/751876927723143178/glass-celebration.png';
			}
		},
		openBountyThumbnailURL: {
			type: DataTypes.STRING,
			get() {
				return this.getDataValue("openBountyThumbnailURL") ?? "https://cdn.discordapp.com/attachments/545684759276421120/734093574031016006/bountyboard.png";
			}
		},
		completedBountyThumbnailURL: {
			type: DataTypes.STRING,
			get() {
				return this.getDataValue("completedBountyThumbnailURL") ?? "https://cdn.discordapp.com/attachments/545684759276421120/734092918369026108/completion.png";
			}
		},
		deletedBountyThumbnailURL: {
			type: DataTypes.STRING,
			get() {
				return this.getDataValue("deletedBountyThumbnailURL") ?? "https://cdn.discordapp.com/attachments/545684759276421120/734093574031016006/bountyboard.png";
			}
		},
		scoreboardThumbnailURL: {
			type: DataTypes.STRING,
			get() {
				return this.getDataValue("scoreboardThumbnailURL") ?? "https://cdn.discordapp.com/attachments/545684759276421120/734094693217992804/scoreboard.png";
			}
		},
		goalCompletionThumbnailURL: {
			type: DataTypes.STRING,
			get() {
				return this.getDataValue("goalCompletionThumbnailURL") ?? "https://cdn.discordapp.com/attachments/673600843630510123/1309260766318166117/trophy-cup.png?ex=6740ef9b&is=673f9e1b&hm=218e19ede07dcf85a75ecfb3dde26f28adfe96eb7b91e89de11b650f5c598966&";
			}
		},
		raffleThumbnailURL: {
			type: DataTypes.STRING,
			get() {
				return this.getDataValue("raffleThumbnailURL") ?? "https://cdn.discordapp.com/attachments/545684759276421120/1387920759870984283/ticket.png?ex=685f196f&is=685dc7ef&hm=a8e49b311c5c8854b0fc68ef9d2cf00aead714a0d21438b1b9fa2089f8e7a3de&";
			}
		}
	}, {
		sequelize,
		modelName: "Company",
		freezeTableName: true
	});
};

export function associate(models: Database) {
	Company.hasMany(models.Ranks, { foreignKey: "companyId" });
	Company.hasMany(models.Hunters, { foreignKey: "companyId" });
	Company.hasMany(models.Bounties, { foreignKey: "companyId" });
	Company.hasMany(models.Completions, { foreignKey: "companyId" });
	Company.hasMany(models.Toasts, { foreignKey: "companyId" });
	Company.hasMany(models.Seasons, { foreignKey: "companyId" });
	Company.hasMany(models.Participations, { foreignKey: "companyId" });
	Company.hasMany(models.Goals, { foreignKey: "companyId" });
}
