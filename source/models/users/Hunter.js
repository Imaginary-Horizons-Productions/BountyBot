const { DataTypes, Model } = require('sequelize');
const { database } = require('../../../database');
const { congratulationBuilder } = require('../../helpers');
const { Guild } = require('discord.js');

/** This class stores a user's information related to a specific company */
exports.Hunter = class extends Model {
	static xpThreshold(level, xpCoefficient) {
		// xp = xpCoefficient*(level - 1)^2
		return xpCoefficient * (level - 1) ** 2;
	}

	maxSlots(maxSimBounties) {
		let slots = 1 + Math.floor(this.level / 12) * 2;
		let remainder = this.level % 12;
		if (remainder >= 3) {
			slots++;
			remainder -= 3;
		}
		if (remainder >= 7) {
			slots++;
		}
		return Math.min(slots, maxSimBounties);
	}

	/**
	 * @param {Guild} guild
	 * @param {number} points
	 * @param {boolean} ignoreMultiplier
	 * @returns {string} level-up text
	 */
	async addXP(guild, points, ignoreMultiplier) { //TODONOW switch guild to guildName
		const company = await database.models.Company.findByPk(this.companyId);
		const totalPoints = points * (!ignoreMultiplier ? company.eventMultiplier : 1);

		const previousLevel = this.level;
		const previousCompanyLevel = company.level;

		this.xp += totalPoints;
		const [season] = await database.models.Season.findOrCreate({ where: { companyId: this.companyId, isCurrentSeason: true } });
		const [seasonParticipation, participationCreated] = await database.models.SeasonParticipation.findOrCreate({ where: { companyId: this.companyId, userId: this.userId, seasonId: season.id }, defaults: { xp: totalPoints } });
		if (!participationCreated) {
			seasonParticipation.increment({ xp: totalPoints });
		}

		this.level = Math.floor(Math.sqrt(this.xp / company.xpCoefficient) + 1);
		this.save();

		company.level = Math.floor(Math.sqrt(await company.xp / 3) + 1);
		company.save();

		let levelText = "";
		if (this.level > previousLevel) {
			const rewards = [];
			for (let level = previousLevel + 1; level <= this.level; level++) {
				rewards.push(this.levelUpReward(level, company.maxSimBounties, false));
			}
			levelText += `${congratulationBuilder()}, <@${this.userId}>! You have leveled up to level **${this.level}**!\n${rewards.join('\n')}`;
		}

		if (company.level > previousCompanyLevel) {
			levelText += `*${guild.name} is now level ${company.level}! Evergreen bounties are now worth more XP!*\n`;
		}

		return levelText;
	}

	// myModDetails(guild, member, { maxSimBounties, pinChannelId }, lastFiveBounties) {
	// 	const { prefix, text, url } = tipBuilder(maxSimBounties, guild.channels.resolve(pinChannelId), true);
	// 	let embed = new MessageEmbed().setColor(member.displayColor)
	// 		.setAuthor({ name: prefix + text, iconURL: guild.client.user.displayAvatarURL(), url })
	// 		.setTitle(`Moderation Stats: ${member.user.tag}`)
	// 		.setThumbnail(member.user.avatarURL())
	// 		.setDescription(`Display Name: **${member.displayName}** (id: *${member.id}*)\nAccount created on: ${member.user.createdAt.toDateString()}\nJoined server on: ${member.joinedAt.toDateString()}`)
	// 		.addField(`Bans`, `Currently Banned: ${this.isBanned ? "Yes" : "No"}\nHas Been Banned: ${this.hasBeenBanned ? "Yes" : "No"}`, true)
	// 		.addField(`Disqualifications`, `${this.seasonDQCount} season DQs`, true)
	// 		.addField(`Penalties`, `${this.penaltyCount} penalties (${this.penaltyPointCount} points total)`, true)
	// 		.addField(`Taboo Filter`, `${this.tabooCount} infractions`, true)
	// 		.setFooter({ text: guild.name, iconURL: guild.iconURL() })
	// 		.setTimestamp();

	// 	let bountyHistory = "";
	// 	lastFiveBounties.forEach(bounty => {
	// 		bountyHistory += `__${bounty.title}__ ${bounty.description}\n${bounty.xpAwarded} XP per completer\nCompleters: <@${bounty.completers.join('>, <@')}>\n\n`;
	// 	})

	// 	if (bountyHistory === "") {
	// 		bountyHistory = "No recent bounties";
	// 	}
	// 	return embed.addField("Last 5 Completed Bounties Created by this User", bountyHistory);
	// }

	levelUpReward(level, maxSlots, futureReward = true) {
		let text = "";
		if (level % 2) {
			text += `Your bounties in odd-numbered slots ${futureReward ? "will increase" : "have increased"} in value.`;
		} else {
			text += `Your bounties in even-numbered slots ${futureReward ? "will increase" : "have increased"} in value.`;
		}
		const currentSlots = this.maxSlots(maxSlots);
		if (currentSlots < maxSlots) {
			if (level == 3 + 12 * Math.floor((currentSlots - 2) / 2) + 7 * ((currentSlots - 2) % 2)) {
				text += ` You ${futureReward ? "will" : "have"} unlock${futureReward ? "" : "ed"} bounty slot #${currentSlots}.`;
			};
		}
		return text;
	}
}

exports.initModel = function (sequelize) {
	exports.Hunter.init({
		userId: {
			primaryKey: true,
			type: DataTypes.STRING,
		},
		companyId: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		level: {
			type: DataTypes.BIGINT,
			defaultValue: 1
		},
		xp: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		isRankEligible: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		rank: {
			type: DataTypes.INTEGER,
			defaultValue: null
		},
		lastRank: {
			type: DataTypes.INTEGER,
			defaultValue: null
		},
		nextRankXP: {
			type: DataTypes.BIGINT,
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
		tabooCount: {
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
		}
	}, {
		sequelize,
		modelName: 'Hunter',
		freezeTableName: true
	});
}
