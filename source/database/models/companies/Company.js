const { bold, italic } = require('discord.js');
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

	/** @param {Hunter[]} hunters */
	getXP(hunters) {
		return hunters.reduce((total, hunter) => total + hunter.getLevel(this.xpCoefficient), 0);
	}

	/** @param {Hunter[]} hunters */
	getLevel(hunters) {
		return Math.floor(Math.sqrt(this.getXP(hunters) / 3) + 1);
	}

	getThumbnailURLMap() {
		return {
			open: this.openBountyThumbnailURL ?? "https://cdn.discordapp.com/attachments/545684759276421120/734093574031016006/bountyboard.png",
			complete: this.completedBountyThumbnailURL ?? "https://cdn.discordapp.com/attachments/545684759276421120/734092918369026108/completion.png",
			deleted: this.deletedBountyThumbnailURL ?? "https://cdn.discordapp.com/attachments/545684759276421120/734093574031016006/bountyboard.png"
		};
	}

	festivalMultiplierString() {
		if (this.festivalMultiplier != 1) {
			return ` ${bold(italic(`x${this.festivalMultiplier}`))}`;
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
			type: DataTypes.INTEGER,
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
			type: DataTypes.STRING
		},
		openBountyThumbnailURL: {
			type: DataTypes.STRING
		},
		completedBountyThumbnailURL: {
			type: DataTypes.STRING
		},
		deletedBountyThumbnailURL: {
			type: DataTypes.STRING
		},
		scoreboardThumbnailURL: {
			type: DataTypes.STRING
		}
	}, {
		sequelize,
		modelName: "Company",
		freezeTableName: true
	});
};

module.exports = { Company, initModel };
