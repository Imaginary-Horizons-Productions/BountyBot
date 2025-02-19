const { userMention, italic, heading } = require('discord.js');
const { Model, Sequelize, DataTypes } = require('sequelize');
const { MAX_MESSAGE_CONTENT_LENGTH } = require('../../constants');
const { commandMention } = require('../../util/textUtil');

/** This model represents a toast raised for a group of bounty hunters */
class Toast extends Model {
	static associate(models) {
		models.Toast.Company = models.Toast.belongsTo(models.Company, {
			foreignKey: "companyId"
		});
		models.Toast.User = models.Toast.belongsTo(models.User, {
			foreignKey: "senderId"
		});
		models.Toast.Recipients = models.Toast.hasMany(models.Recipient, {
			foreignKey: "toastId"
		});
		models.Toast.Secondings = models.Toast.hasMany(models.Seconding, {
			foreignKey: "toastId"
		});
	}

	/**
	 * @param {string[]} rewardedHunterIds
	 * @param {string[]} rankUpdates
	 * @param {string[]} rewardTexts
	 * @param {string} senderMention
	 * @param {string} multiplierString
	 * @param {number} critValue
	 */
	static generateRewardString(rewardedHunterIds, rankUpdates, rewardTexts, senderMention, multiplierString, critValue) {
		let rewardString = `${heading("XP Gained", 2)}\n${rewardedHunterIds.map(id => `${userMention(id)} +1 XP${multiplierString}`).join("\n")}`;
		if (critValue > 0) {
			rewardString += `\n${senderMention} + ${critValue} XP${multiplierString} ${italic("Critical Toast!")}`;
		}
		if (rankUpdates.length > 0) {
			rewardString += `\n${heading("Rank Ups", 2)}\n- ${rankUpdates.join("\n- ")}`;
		}
		if (rewardTexts.length > 0) {
			rewardString += `\n${heading("Rewards", 2)}\n- ${rewardTexts.join("\n- ")}`;
		}
		if (rewardString.length > MAX_MESSAGE_CONTENT_LENGTH) {
			return `Message overflow! Many people (?) probably gained many things (?). Use ${commandMention("stats")} to look things up.`;
		}
		return rewardString;
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	Toast.init({
		id: {
			primaryKey: true,
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4
		},
		companyId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		senderId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		text: {
			type: DataTypes.STRING,
			allowNull: false
		},
		imageURL: {
			type: DataTypes.STRING,
		},
		secondings: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		}
	}, {
		sequelize,
		modelName: "Toast",
		freezeTableName: true
	});
	return Toast;
}

module.exports = { Toast, initModel };
