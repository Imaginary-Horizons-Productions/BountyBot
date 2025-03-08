const { MessageFlags, EmbedBuilder, Colors } = require('discord.js');
const { Model, Sequelize, DataTypes } = require('sequelize');
const { ihpAuthorPayload, randomFooterTip } = require('../../util/embedUtil');
const { generateTextBar } = require('../../util/textUtil');
const { Season } = require('../seasons/Season');

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

	festivalMultiplierString() {
		if (this.festivalMultiplier != 1) {
			return ` ***x${this.festivalMultiplier}***`;
		} else {
			return "";
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

	/**
	 * @param {Guild} guild
	 * @param {number} participantCount
	 * @param {number} currentLevelThreshold
	 * @param {number} nextLevelThreshold
	 * @param {Season} currentSeason
	 * @param {Season} lastSeason
	 */
	async statsEmbed(guild, participantCount, currentLevelThreshold, nextLevelThreshold, currentSeason, lastSeason) {
		const companyXP = await this.xp;
		const currentSeasonXP = await currentSeason.totalXP;
		const lastSeasonXP = await lastSeason?.totalXP ?? 0;

		const particpantPercentage = participantCount / guild.memberCount * 100;
		const seasonXPDifference = currentSeasonXP - lastSeasonXP;
		const seasonBountyDifference = currentSeason.bountiesCompleted - (lastSeason?.bountiesCompleted ?? 0);
		const seasonToastDifference = currentSeason.toastsRaised - (lastSeason?.toastsRaised ?? 0);
		return new EmbedBuilder().setColor(Colors.Blurple)
			.setAuthor(ihpAuthorPayload)
			.setTitle(`${guild.name} is __Level ${this.level}__`)
			.setThumbnail(guild.iconURL())
			.setDescription(`${generateTextBar(companyXP - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)}*Next Level:* ${nextLevelThreshold - companyXP} Bounty Hunter Levels`)
			.addFields(
				{ name: "Total Bounty Hunter Level", value: `${companyXP} level${companyXP == 1 ? "" : "s"}`, inline: true },
				{ name: "Participation", value: `${participantCount} server members have interacted with BountyBot this season (${particpantPercentage.toPrecision(3)}% of server members)` },
				{ name: `${currentSeasonXP} XP Earned Total (${seasonXPDifference === 0 ? "same as last season" : `${seasonXPDifference > 0 ? `+${seasonXPDifference} more XP` : `${seasonXPDifference * -1} fewer XP`} than last season`})`, value: `${currentSeason.bountiesCompleted} bounties (${seasonBountyDifference === 0 ? "same as last season" : `${seasonBountyDifference > 0 ? `**+${seasonBountyDifference} more bounties**` : `**${seasonBountyDifference * -1} fewer bounties**`} than last season`})\n${currentSeason.toastsRaised} toasts (${seasonToastDifference === 0 ? "same as last season" : `${seasonToastDifference > 0 ? `**+${seasonToastDifference} more toasts**` : `**${seasonToastDifference * -1} fewer toasts**`} than last season`})` }
			)
			.setFooter(randomFooterTip())
			.setTimestamp()
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	return Company.init({
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
		scoreboardThumbnailURL: {
			type: DataTypes.STRING
		}
	}, {
		sequelize,
		modelName: "Company",
		freezeTableName: true,
		paranoid: true
	});
};

module.exports = { Company, initModel };
