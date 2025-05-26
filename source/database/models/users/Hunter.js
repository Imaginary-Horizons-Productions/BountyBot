const { Model, Sequelize, DataTypes } = require('sequelize');

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

	/** @param {number} xpCoefficient */
	getLevel(xpCoefficient) {
		return Math.floor(Math.sqrt(this.xp / xpCoefficient) + 1);
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
