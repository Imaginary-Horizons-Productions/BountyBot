const { DataTypes, Model, Sequelize } = require('sequelize');
const { congratulationBuilder } = require('../../util/textUtil');

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
	 * @param {string} guildName
	 * @param {number} points
	 * @param {boolean} ignoreMultiplier
	 * @param {Sequelize} database
	 * @returns {string} level-up text
	 */
	async addXP(guildName, points, ignoreMultiplier, database) {
		const company = await database.models.Company.findByPk(this.companyId);
		const totalPoints = points * (!ignoreMultiplier ? company.eventMultiplier : 1);

		const previousLevel = this.level;
		const previousCompanyLevel = company.level;

		this.xp += totalPoints;
		const [season] = await database.models.Season.findOrCreate({ where: { companyId: this.companyId, isCurrentSeason: true } });
		const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { companyId: this.companyId, userId: this.userId, seasonId: season.id }, defaults: { xp: totalPoints } });
		if (!participationCreated) {
			participation.increment({ xp: totalPoints });
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
			levelText += `*${guildName} is now level ${company.level}! Evergreen bounties are now worth more XP!*\n`;
		}

		return levelText;
	}

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

/** @param {Sequelize} sequelize */
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
		modelName: "Hunter",
		freezeTableName: true
	});
}
