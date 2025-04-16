const { EmbedBuilder, Guild, ActionRowBuilder, ButtonBuilder, ButtonStyle, heading, userMention } = require('discord.js');
const { Model, Sequelize, DataTypes } = require('sequelize');
const { SAFE_DELIMITER, MAX_MESSAGE_CONTENT_LENGTH, MAX_EMBED_FIELD_VALUE_LENGTH } = require('../../constants');
const { timeConversion, commandMention, listifyEN } = require('../../util/textUtil');
const { Completion } = require('./Completion');

/** Bounties are user created objectives for other server members to complete */
class Bounty extends Model {
	static associate(models) {
		models.Bounty.Completions = models.Bounty.hasMany(models.Completion, {
			foreignKey: "bountyId"
		});
	}

	/** Generate an embed for the given bounty
	 * @param {Guild} guild
	 * @param {number} posterLevel
	 * @param {boolean} shouldOmitRewardsField
	 * @param {Record<"open" | "complete" | "deleted", string>} thumbnailURLMap
	 * @param {string} multiplierString
	 * @param {Completion[]} completions
	 */
	async embed(guild, posterLevel, shouldOmitRewardsField, thumbnailURLMap, multiplierString, completions) {
		const author = await guild.members.fetch(this.userId);
		const fields = [];
		const embed = new EmbedBuilder().setColor(author.displayColor)
			.setThumbnail(this.thumbnailURL ?? thumbnailURLMap[this.state])
			.setTitle(this.state == "complete" ? `Bounty Complete! ${this.title}` : this.title)
			.setTimestamp();
		if (this.description) {
			embed.setDescription(this.description);
		}
		if (this.attachmentURL) {
			embed.setImage(this.attachmentURL);
		}
		if (this.scheduledEventId) {
			const event = await guild.scheduledEvents.fetch(this.scheduledEventId);
			fields.push({ name: "Time", value: `<t:${event.scheduledStartTimestamp / 1000}> - <t:${event.scheduledEndTimestamp / 1000}>` });
		}
		if (!shouldOmitRewardsField) {
			fields.push({ name: "Reward", value: `${Bounty.calculateCompleterReward(posterLevel, this.slotNumber, this.showcaseCount)} XP${multiplierString}`, inline: true });
		}

		if (this.isEvergreen) {
			embed.setAuthor({ name: `Evergreen Bounty #${this.slotNumber}`, iconURL: author.user.displayAvatarURL() });
		} else {
			embed.setAuthor({ name: `${author.displayName}'s #${this.slotNumber} Bounty`, iconURL: author.user.displayAvatarURL() });
		}
		if (completions.length > 0) {
			const uniqueCompleters = new Set(completions.map(reciept => reciept.userId));
			const completersFieldText = listifyEN([...uniqueCompleters].map(id => userMention(id)));
			if (completersFieldText.length <= MAX_EMBED_FIELD_VALUE_LENGTH) {
				fields.push({ name: "Completers", value: completersFieldText });
			} else {
				fields.push({ name: "Completers", value: "Too many to display!" });
			}
		}

		if (fields.length > 0) {
			embed.addFields(fields);
		}
		return embed;
	}

	/**
	 * @param {string[]} completerIds
	 * @param {number} completerReward
	 * @param {string?} posterId null for evergreen bounties
	 * @param {number?} posterReward null for evergreen bounties
	 * @param {string} multiplierString
	 * @param {string[]} rankUpdates
	 * @param {string[]} rewardTexts
	 */
	static generateRewardString(completerIds, completerReward, posterId, posterReward, multiplierString, rankUpdates, rewardTexts) {
		let text = `${heading("XP Gained", 2)}\n${completerIds.map(id => `${userMention(id)} +${completerReward} XP${multiplierString}`).join("\n")}`;
		if (posterId && posterReward) {
			text += `\n${userMention(posterId)} +${posterReward} XP${multiplierString}`;
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

	/** Update the bounty's embed in the bounty board
	 * @param {Guild} guild
	 * @param {Company} company
	 * @param {number} posterLevel
	 * @param {Completion[]} completions
	 */
	async updatePosting(guild, company, posterLevel, completions) {
		if (company.bountyBoardId) {
			return guild.channels.fetch(company.bountyBoardId).then(bountyBoard => {
				return bountyBoard.threads.fetch(this.postingId);
			}).then(async thread => {
				if (thread.archived) {
					await thread.setArchived(false, "Unarchived to update posting");
				}
				thread.edit({ name: this.title });
				return thread.fetchStarterMessage();
			}).then(async posting => {
				this.embed(guild, posterLevel, false, company.getThumbnailURLMap(), company.festivalMultiplierString(), completions).then(embed => {
					posting.edit({
						embeds: [embed],
						components: this.generateBountyBoardButtons()
					});
				})
			})
		}
	}

	generateBountyBoardButtons() {
		return [
			new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId(`bbcomplete${SAFE_DELIMITER}${this.id}`)
					.setStyle(ButtonStyle.Success)
					.setLabel("Complete")
					.setDisabled(new Date() < new Date(new Date(this.createdAt) + timeConversion(5, "m", "ms"))),
				new ButtonBuilder().setCustomId(`bbaddcompleters${SAFE_DELIMITER}${this.id}`)
					.setStyle(ButtonStyle.Primary)
					.setLabel("Credit Hunters"),
				new ButtonBuilder().setCustomId(`bbremovecompleters${SAFE_DELIMITER}${this.id}`)
					.setStyle(ButtonStyle.Secondary)
					.setLabel("Uncredit Hunters"),
				new ButtonBuilder().setCustomId(`bbshowcase${SAFE_DELIMITER}${this.id}`)
					.setStyle(ButtonStyle.Primary)
					.setLabel("Showcase this Bounty"),
				new ButtonBuilder().setCustomId(`bbtakedown${SAFE_DELIMITER}${this.id}`)
					.setStyle(ButtonStyle.Danger)
					.setLabel("Take Down")
			)
		]
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
			devaultValue: false
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
