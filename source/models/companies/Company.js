const { MessageFlags, EmbedBuilder, Colors, Guild, bold, italic } = require('discord.js');
const { Model, Sequelize, DataTypes } = require('sequelize');
const { ihpAuthorPayload, randomFooterTip } = require('../../util/embedUtil');
const { generateTextBar } = require('../../util/textUtil');
const { Season } = require('../seasons/Season');
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

	/**
	 * @param {number} previousLevel
	 * @param {Hunter[]} allHunters
	 * @param {string} guildName
	 */
	buildLevelUpLine(previousLevel, allHunters, guildName) {
		const currentLevel = this.getLevel(allHunters);
		if (currentLevel > previousLevel) {
			return `${guildName} is now level ${currentLevel}! Evergreen bounties now award more XP!`;
		}
		return null;
	}

	/** @param {Hunter[]} hunters */
	getXP(hunters) {
		return hunters.reduce((total, hunter) => total + hunter.getLevel(this.xpCoefficient), 0);
	}

	/** @param {Hunter[]} hunters */
	getLevel(hunters) {
		return Math.floor(Math.sqrt(this.getXP(hunters) / 3) + 1);
	}

	festivalMultiplierString() {
		if (this.festivalMultiplier != 1) {
			return ` x${bold(italic(this.festivalMultiplier))}`;
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

	/** If the server has a scoreboard reference channel, update the embed in it
	 * @param {Guild} guild
	 * @param {typeof import("../../logic")} logicLayer
	 */
	async updateScoreboard(guild, logicLayer) {
		if (this.scoreboardChannelId && this.scoreboardMessageId) {
			guild.channels.fetch(this.scoreboardChannelId).then(scoreboard => {
				return scoreboard.messages.fetch(this.scoreboardMessageId);
			}).then(async scoreboardMessage => {
				scoreboardMessage.edit({
					embeds: [
						this.scoreboardIsSeasonal ?
							await this.seasonalScoreboardEmbed(guild, logicLayer) :
							await this.overallScoreboardEmbed(guild, logicLayer)
					]
				});
			});
		}
	}

	/** A seasonal scoreboard orders a company's hunters by their seasonal xp
	 * @param {Guild} guild
	 * @param {typeof import("../logic")} logicLayer
	 */
	async seasonalScoreboardEmbed(guild, logicLayer) {
		const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(this.id);
		const participations = await logicLayer.seasons.findSeasonParticipations(season.id);
		const hunterMembers = await guild.members.fetch({ user: participations.map(participation => participation.userId) });
		const rankmojiArray = (await logicLayer.ranks.findAllRanks(guild.id)).map(rank => rank.rankmoji);

		const scorelines = [];
		for (const participation of participations) {
			if (participation.xp > 0) {
				const hunter = await participation.hunter;
				scorelines.push(`${!(hunter.rank === null || participation.isRankDisqualified) ? `${rankmojiArray[hunter.rank]} ` : ""}#${participation.placement} **${hunterMembers.get(participation.userId).displayName}** __Level ${hunter.getLevel(this.xpCoefficient)}__ *${participation.xp} season XP*`);
			}
		}
		const embed = new EmbedBuilder().setColor(Colors.Blurple)
			.setAuthor(ihpAuthorPayload)
			.setThumbnail(this.scoreboardThumbnailURL ?? "https://cdn.discordapp.com/attachments/545684759276421120/734094693217992804/scoreboard.png")
			.setTitle("The Season Scoreboard")
			.setFooter(randomFooterTip())
			.setTimestamp();
		let description = "";
		const andMore = "…and more";
		const maxDescriptionLength = 2048 - andMore.length;
		for (const scoreline of scorelines) {
			if (description.length + scoreline.length <= maxDescriptionLength) {
				description += `${scoreline}\n`;
			} else {
				description += andMore;
				break;
			}
		}

		if (description) {
			embed.setDescription(description);
		} else {
			embed.setDescription("No Bounty Hunters yet…");
		}

		const fields = [];
		const { currentGP, requiredGP } = await logicLayer.goals.findLatestGoalProgress(guild.id);
		if (currentGP < requiredGP) {
			fields.push({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
		}
		if (this.festivalMultiplier !== 1) {
			fields.push({ name: "XP Festival", value: `An XP multiplier festival is currently active for ${this.festivalMultiplierString()}.` });
		}
		if (this.nextRaffleString) {
			fields.push({ name: "Next Raffle", value: `The next raffle will be on ${this.nextRaffleString}!` });
		}

		if (fields.length > 0) {
			embed.addFields(fields);
		}
		return embed;
	}

	/** An overall scoreboard orders a company's hunters by total xp
	 * @param {Guild} guild
	 * @param {typeof import("../logic")} logicLayer
	 */
	async overallScoreboardEmbed(guild, logicLayer) {
		const hunters = await logicLayer.hunters.findCompanyHuntersByDescendingXP(guild.id);
		const hunterMembers = await guild.members.fetch({ user: hunters.map(hunter => hunter.userId) });
		const rankmojiArray = (await logicLayer.ranks.findAllRanks(guild.id)).map(rank => rank.rankmoji);

		const scorelines = [];
		for (const hunter of hunters) {
			if (hunter.xp > 0) {
				scorelines.push(`${hunter.rank !== null ? `${rankmojiArray[hunter.rank]} ` : ""} **${hunterMembers.get(hunter.userId).displayName}** __Level ${hunter.getLevel(this.xpCoefficient)}__ *${hunter.xp} XP*`);
			}
		}
		const embed = new EmbedBuilder().setColor(Colors.Blurple)
			.setAuthor(ihpAuthorPayload)
			.setThumbnail(this.scoreboardThumbnailURL ?? "https://cdn.discordapp.com/attachments/545684759276421120/734094693217992804/scoreboard.png")
			.setTitle("The Scoreboard")
			.setFooter(randomFooterTip())
			.setTimestamp();
		let description = "";
		const andMore = "…and more";
		const maxDescriptionLength = 2048 - andMore.length;
		for (const scoreline of scorelines) {
			if (description.length + scoreline.length <= maxDescriptionLength) {
				description += `${scoreline}\n`;
			} else {
				description += andMore;
				break;
			}
		}

		if (description) {
			embed.setDescription(description);
		} else {
			embed.setDescription("No Bounty Hunters yet…");
		}

		const fields = [];
		const { currentGP, requiredGP } = await logicLayer.goals.findLatestGoalProgress(guild.id);
		if (currentGP < requiredGP) {
			fields.push({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
		}
		if (this.festivalMultiplier !== 1) {
			fields.push({ name: "XP Festival", value: `An XP multiplier festival is currently active for ${this.festivalMultiplierString()}.` });
		}
		if (this.nextRaffleString) {
			fields.push({ name: "Next Raffle", value: `The next raffle will be on ${this.nextRaffleString}!` });
		}

		if (fields.length > 0) {
			embed.addFields(fields);
		}

		return embed;
	}

	/**
	 * @param {Guild} guild
	 * @param {Hunter[]} allHunters
	 * @param {number} participantCount
	 * @param {number} currentLevelThreshold
	 * @param {number} nextLevelThreshold
	 * @param {Season} currentSeason
	 * @param {Season} lastSeason
	 */
	async statsEmbed(guild, allHunters, participantCount, currentLevelThreshold, nextLevelThreshold, currentSeason, lastSeason) {
		const companyXP = this.getXP(allHunters);
		const currentSeasonXP = await currentSeason.totalXP;
		const lastSeasonXP = await lastSeason?.totalXP ?? 0;

		const particpantPercentage = participantCount / guild.memberCount * 100;
		const seasonXPDifference = currentSeasonXP - lastSeasonXP;
		const seasonBountyDifference = currentSeason.bountiesCompleted - (lastSeason?.bountiesCompleted ?? 0);
		const seasonToastDifference = currentSeason.toastsRaised - (lastSeason?.toastsRaised ?? 0);
		return new EmbedBuilder().setColor(Colors.Blurple)
			.setAuthor(ihpAuthorPayload)
			.setTitle(`${guild.name} is __Level ${this.getLevel(allHunters)}__`)
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
		freezeTableName: true
	});
};

module.exports = { Company, initModel };
