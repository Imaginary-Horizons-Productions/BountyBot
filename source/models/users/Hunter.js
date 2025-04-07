const { Model, Sequelize, DataTypes } = require('sequelize');
const { listifyEN, congratulationBuilder } = require('../../util/textUtil');
const { Bounty } = require('../bounties/Bounty');
const { EmbedBuilder, userMention, bold } = require('discord.js');
const { randomFooterTip } = require('../../util/embedUtil');
const { Completion } = require('../bounties/Completion');

/** This class stores a user's information related to a specific company */
class Hunter extends Model {
	static associate(models) {
		models.Hunter.User = models.Hunter.belongsTo(models.User, {
			foreignKey: "userId"
		});
	}

	/**
	 * @param {number} level
	 * @param {number} xpCoefficient
	 */
	static xpThreshold(level, xpCoefficient) {
		// xp = xpCoefficient*(level - 1)^2
		return xpCoefficient * (level - 1) ** 2;
	}

	/**
	 * @param {number} level
	 * @param {number} maxSimBounties
	 */
	static getBountySlotCount(level, maxSimBounties) {
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

	/**
	 * @param {number} level
	 * @param {number} maxSlots
	 * @param {boolean} futureReward
	 */
	static getLevelUpRewards(level, maxSlots, futureReward = true) {
		const texts = [];
		if (level % 2) {
			texts.push(`Your bounties in odd-numbered slots ${futureReward ? "will increase" : "have increased"} in value.`);
		} else {
			texts.push(`Your bounties in even-numbered slots ${futureReward ? "will increase" : "have increased"} in value.`);
		}
		const currentSlots = Hunter.getBountySlotCount(level, maxSlots);
		if (currentSlots < maxSlots) {
			if (level == 3 + 12 * Math.floor((currentSlots - 2) / 2) + 7 * ((currentSlots - 2) % 2)) {
				texts.push(` You ${futureReward ? "will unlock" : "have unlocked"} bounty slot #${currentSlots}.`);
			};
		}
		return texts;
	}

	/**
	 * @param {number} previousLevel
	 * @param {number} currentLevel
	 * @param {string} userId
	 */
	buildLevelUpLine(previousLevel, xpCoefficient) {
		const currentLevel = this.getLevel(xpCoefficient);
		if (currentLevel > previousLevel) {
			const rewards = [];
			for (let level = previousLevel + 1; level <= currentLevel; level++) {
				rewards.push(...Hunter.getLevelUpRewards(level, company.maxSimBounties, false));
			}
			return `${congratulationBuilder()}, ${userMention(this.userId)}! You have leveled up to level ${bold(currentLevel)}!\n\t- ${rewards.join('\n\t- ')}`;
		}
		return null;
	}


	/** @param {number} xpCoefficient */
	getLevel(xpCoefficient) {
		return Math.floor(Math.sqrt(this.xp / xpCoefficient) + 1);
	}

	/**
	* @param {Guild} guild
	* @param {GuildMember} member
	* @param {number} dqCount
	* @param {(Bounty & {Completions: Completion[]})[]} lastFiveBounties
	*/
	modStatsEmbed(guild, member, dqCount, lastFiveBounties) {
		const embed = new EmbedBuilder().setColor(member.displayColor)
			.setAuthor({ name: guild.name, iconURL: guild.iconURL() })
			.setTitle(`Moderation Stats: ${member.user.tag}`)
			.setThumbnail(member.user.avatarURL())
			.setDescription(`Display Name: **${member.displayName}** (id: *${member.id}*)\nAccount created on: ${member.user.createdAt.toDateString()}\nJoined server on: ${member.joinedAt.toDateString()}`)
			.addFields(
				{ name: "Bans", value: `Currently Banned: ${this.isBanned ? "Yes" : "No"}\nHas Been Banned: ${this.hasBeenBanned ? "Yes" : "No"}`, inline: true },
				{ name: "Disqualifications", value: `${dqCount} season DQs`, inline: true },
				{ name: "Penalties", value: `${this.penaltyCount} penalties (${this.penaltyPointTotal} points total)`, inline: true }
			)
			.setFooter(randomFooterTip())
			.setTimestamp();

		let bountyHistory = "";
		for (let i = 0; i < lastFiveBounties.length; i++) {
			const bounty = lastFiveBounties[i];
			bountyHistory += `__${bounty.title}__${bounty.description !== null ? ` ${bounty.description}` : ""}${listifyEN(bounty.Completions.map(completion => `\n${userMention(completion.userId)} +${completion.xpAwarded} XP`))}\n\n`;
		}

		if (bountyHistory === "") {
			bountyHistory = "No recent bounties";
		}
		return embed.addFields({ name: "Last 5 Completed Bounties Created by this User", value: bountyHistory });
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
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

module.exports = { Hunter, initModel };
