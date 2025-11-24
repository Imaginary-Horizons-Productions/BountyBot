const { Model, Sequelize, DataTypes } = require('sequelize');

/** Bounties are user created objectives for other server members to complete */
class Bounty extends Model {
	static associate(models) {
		models.Bounty.Completions = models.Bounty.hasMany(models.Completion, {
			foreignKey: "bountyId"
		});
	}

	/**
	 * @param {number} posterLevel
	 * @param {number} slotNumber
	 * @param {number} showcaseCount
	 */
	static calculateCompleterReward(posterLevel, slotNumber, showcaseCount) {
		const showcaseMultiplier = 0.25 * showcaseCount + 1;
		return Math.max(2, Math.floor((6 + 0.5 * posterLevel - 3 * slotNumber + 0.5 * slotNumber % 2) * showcaseMultiplier));
	}

	/** @param {number} hunterCount */
	calculatePosterReward(hunterCount) {
		let posterXP = Math.ceil(hunterCount / 2);
		for (const property of ["description", "thumbnailURL", "attachmentURL", "scheduledEventId"]) {
			if (this[property] !== null) {
				posterXP++;
			}
		}
		return posterXP;
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	return Bounty.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		userId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		companyId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		postingId: {
			type: DataTypes.STRING
		},
		slotNumber: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		isEvergreen: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		},
		title: {
			type: DataTypes.STRING,
			allowNull: false
		},
		thumbnailURL: {
			type: DataTypes.STRING
		},
		description: {
			type: DataTypes.STRING
		},
		attachmentURL: {
			type: DataTypes.STRING,
			defaultValue: null
		},
		scheduledEventId: {
			type: DataTypes.STRING,
			defaultValue: null
		},
		state: { // Allowed values: "open", "completed", "deleted"
			type: DataTypes.STRING,
			defaultValue: "open"
		},
		showcaseCount: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		completedAt: {
			type: DataTypes.DATE,
			defaultValue: null
		},
		editCount: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		}
	}, {
		sequelize,
		modelName: "Bounty",
		freezeTableName: true
	});
};

module.exports = { Bounty, initModel };
