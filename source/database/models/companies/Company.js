const { italic } = require('discord.js');
const { Model, Sequelize, DataTypes } = require('sequelize');
const { Hunter } = require('../users/Hunter');

/** A Company of bounty hunters contains a Discord Guild's information and settings */
class Company extends Model {
	static associate(models) {
		models.Company.Ranks = models.Company.hasMany(models.Rank, {
			foreignKey: "companyId"
		});
		models.Company.Hunters = models.Company.hasMany(models.Hunter, {
			foreignKey: "companyId"
		});
		models.Company.Bounties = models.Company.hasMany(models.Bounty, {
			foreignKey: "companyId"
		});
		models.Company.Completions = models.Company.hasMany(models.Completion, {
			foreignKey: "companyId"
		});
		models.Company.Toasts = models.Company.hasMany(models.Toast, {
			foreignKey: "companyId"
		});
		models.Company.Seasons = models.Company.hasMany(models.Season, {
			foreignKey: "companyId"
		})
		models.Company.Participations = models.Company.hasMany(models.Participation, {
			foreignKey: "companyId"
		})
		models.Company.Goals = models.Company.hasMany(models.Goal, {
			foreignKey: "companyId"
		})
	}

	/** @param {Map<string, Hunter>} hunterMap */
	getXP(hunterMap) {
		let xp = 0;
		for (const [_, hunter] of hunterMap) {
			xp += hunter.getLevel(this.xpCoefficient);
		}
		return xp;
	}

	/** @param {number} xp */
	static getLevel(xp) {
		return Math.floor(Math.sqrt(xp / 3) + 1);
	}

	festivalMultiplierString() {
		if (this.festivalMultiplier != 1) {
			return ` ${italic(`x${this.festivalMultiplier}`)}`;
		} else {
			return "";
		}
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	return Company.init({
		id: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		announcementPrefix: { // allowed values: "@here", "@everyone", "@silent", ""
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
		festivalMultiplier: {
			type: DataTypes.REAL,
			defaultValue: 1
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

module.exports = { Company, initModel };
