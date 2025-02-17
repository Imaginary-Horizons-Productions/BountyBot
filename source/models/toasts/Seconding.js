const { Model, Sequelize, DataTypes } = require('sequelize');
const { MAX_MESSAGE_CONTENT_LENGTH } = require('../../constants');
const { commandMention } = require('../../util/textUtil');
const { userMention, heading, italic } = require('discord.js');

/** This class stores receipts of a toast seconding */
class Seconding extends Model {
	static associate(models) {
		models.Seconding.Toast = models.Seconding.belongsTo(models.Toast, {
			foreignKey: "toastId"
		});
		models.Seconding.User = models.Seconding.belongsTo(models.User, {
			foreignKey: "seconderId"
		});
	}

	/**
	 * @param {string} seconderDisplayName
	 * @param {string[]} recipientIds
	 * @param {string[]} rankUpdates
	 * @param {string[]} rewardTexts
	 */
	static generateRewardString(seconderDisplayName, recipientIds, rankUpdates, rewardTexts) {
		let text = `${seconderDisplayName} seconded this toast!\n${heading("XP Gained", 2)}`;
		for (const id of recipientIds) {
			text += `\n${userMention(id)} +1 XP`;
			if (id === seconderDisplayName) {
				text += ` ${italic("Critical Toast!")}`;
			}
		}
		if (rankUpdates.length > 0) {
			text += `\n${heading("Rank Ups", 2)}\n- ${rankUpdates.join("\n- ")}`;
		}
		if (rewardTexts.length > 0) {
			text += `\n${heading("Rewards", 2)}\n- ${rewardTexts.join("\n- ")}`;
		}
		if (text.length > MAX_MESSAGE_CONTENT_LENGTH) {
			return `Message overflow! Many people (?) probably gained many things (?). Use ${commandMention("stats")} to look things up.`;
		}
		return text;
	}
}

/** @param {Sequelize} sequelize */
function initModel(sequelize) {
	Seconding.init({
		toastId: {
			primaryKey: true,
			type: DataTypes.BIGINT
		},
		seconderId: {
			primaryKey: true,
			type: DataTypes.STRING
		},
		wasCrit: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		}
	}, {
		sequelize,
		modelName: "Seconding",
		freezeTableName: true
	});
	return Seconding;
}

module.exports = { Seconding, initModel };
