const { userMention, italic, heading, EmbedBuilder, GuildMember, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Model, Sequelize, DataTypes } = require('sequelize');
const { MAX_MESSAGE_CONTENT_LENGTH, SAFE_DELIMITER } = require('../../constants');
const { commandMention, listifyEN } = require('../../util/textUtil');

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
	 * @param {string?} thumbnailURL
	 * @param {string} toastText
	 * @param {string[]} recipientIds
	 * @param {GuildMember} senderMember
	 */
	static generateEmbed(thumbnailURL, toastText, recipientIds, senderMember) {
		return new EmbedBuilder().setColor("e5b271")
			.setThumbnail(thumbnailURL ?? 'https://cdn.discordapp.com/attachments/545684759276421120/751876927723143178/glass-celebration.png')
			.setTitle(toastText)
			.setDescription(`A toast to ${listifyEN(recipientIds.map(id => userMention(id)))}!`)
			.setFooter({ text: senderMember.displayName, iconURL: senderMember.user.avatarURL() });
	}

	/** @param {string} toastId */
	static generateSecondingActionRow(toastId) {
		return new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId(`secondtoast${SAFE_DELIMITER}${toastId}`)
				.setLabel("Hear, hear!")
				.setEmoji("🥂")
				.setStyle(ButtonStyle.Primary)
		)
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
	return Toast.init({
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
}

module.exports = { Toast, initModel };
