const { MessageFlags } = require('discord.js');
const { DataTypes, Model, Sequelize } = require('sequelize');

/** A Company of bounty hunters contains a Discord Guild's information and settings */
exports.Company = class extends Model {
	eventMultiplierString() {
		if (this.eventMultiplier != 1) {
			return ` ***x${this.eventMultiplier}***`;
		} else {
			return '';
		}
	}

	/** Apply the company's announcement prefix to the message (bots suppress notifications through flags instead of starting with "@silent")
	 * @param {import('discord.js').MessageCreateOptions} messageOptions
	 */
	sendAnnouncement(messageOptions) {
		if (this.announcementPrefix == "@silent") {
			if ("flags" in messageOptions) {
				messageOptions.flags |= MessageFlags.SuppressNotifications;
			} else {
				messageOptions.flags = MessageFlags.SuppressNotifications;
			}
		} else if (this.announcementPrefix != "") {
			messageOptions.content = `${this.announcementPrefix} ${messageOptions.content}`;
		}
		return messageOptions;
	}
}

/** @param {Sequelize} sequelize */
exports.initModel = function (sequelize) {
	exports.Company.init({
		id: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		xp: {
			type: DataTypes.VIRTUAL,
			async get() {
				return await sequelize.models.Hunter.sum("level", { where: { companyId: this.id } }) ?? 0;
			}
		},
		level: {
			type: DataTypes.INTEGER,
			defaultValue: 1
		},
		announcementPrefix: { // allowed values: "@here", "@everyone", "@silent", ""
			type: DataTypes.STRING,
			defaultValue: '@here'
		},
		disableBoostXP: {
			type: DataTypes.BOOLEAN,
			defaultValue: true
		},
		maxSimBounties: {
			type: DataTypes.INTEGER,
			defaultValue: 5
		},
		backupTimer: {
			type: DataTypes.BIGINT,
			defaultValue: 3600000
		},
		eventMultiplier: {
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
		}
	}, {
		sequelize,
		modelName: "Company",
		freezeTableName: true,
		paranoid: true
	});
}
