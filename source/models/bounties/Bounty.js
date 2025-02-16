const { EmbedBuilder, Guild, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Model, Sequelize, DataTypes } = require('sequelize');
const { Company } = require('../companies/Company');
const { SAFE_DELIMITER } = require('../../constants');
const { timeConversion } = require('../../util/textUtil');

/** Bounties are user created objectives for other server members to complete */
class Bounty extends Model {
	static associate(models) {
		models.Bounty.Completions = models.Bounty.hasMany(models.Completion, {
			foreignKey: "bountyId"
		});
	}

	/** Generate an embed for the given bounty, in addition to fetching prerequisite data
	 * @param {Guild} guild
	 * @param {number} posterLevel
	 * @param {string} festivalMultiplierString
	 * @param {boolean} shouldOmitRewardsField
	 * @param {Sequelize} database
	 */
	async asEmbed(guild, posterLevel, festivalMultiplierString, shouldOmitRewardsField, database) {
		const [company, completions] = await Promise.all([database.models.Company.findByPk(guild.id), database.models.Completion.findAll({ where: { bountyId: this.id } })]);
		return this.embed(guild, posterLevel, festivalMultiplierString, shouldOmitRewardsField, company, completions);
	}

	/** Generate an embed for the given bounty
	 * @param {Guild} guild
	 * @param {number} posterLevel
	 * @param {boolean} shouldOmitRewardsField
	 * @param {Company} company
	 * @param {Completion[]} completions
	 */
	embed(guild, posterLevel, shouldOmitRewardsField, company, completions) {
		return guild.members.fetch(this.userId).then(async author => {
			const thumbnails = {
				open: company.openBountyThumbnailURL ?? "https://cdn.discordapp.com/attachments/545684759276421120/734093574031016006/bountyboard.png",
				complete: company.completedBountyThumbnailURL ?? "https://cdn.discordapp.com/attachments/545684759276421120/734092918369026108/completion.png",
				deleted: "https://cdn.discordapp.com/attachments/545684759276421120/734093574031016006/bountyboard.png"
			};
			const fields = [];
			const embed = new EmbedBuilder().setColor(author.displayColor)
				.setThumbnail(this.thumbnailURL ?? thumbnails[this.state])
				.setTitle(this.state == "complete" ? `Bounty Complete! ${this.title}` : this.title)
				.setTimestamp();
			if (this.description) {
				embed.setDescription(this.description)
			}
			if (this.attachmentURL) {
				embed.setImage(this.attachmentURL);
			}
			if (this.scheduledEventId) {
				const event = await guild.scheduledEvents.fetch(this.scheduledEventId);
				fields.push({ name: "Time", value: `<t:${event.scheduledStartTimestamp / 1000}> - <t:${event.scheduledEndTimestamp / 1000}>` });
			}
			if (!shouldOmitRewardsField) {
				fields.push({ name: "Reward", value: `${Bounty.calculateCompleterReward(posterLevel, this.slotNumber, this.showcaseCount)} XP${company.festivalMultiplierString()}`, inline: true });
			}

			if (this.isEvergreen) {
				embed.setAuthor({ name: `Evergreen Bounty #${this.slotNumber}`, iconURL: author.user.displayAvatarURL() });
			} else {
				embed.setAuthor({ name: `${author.displayName}'s #${this.slotNumber} Bounty`, iconURL: author.user.displayAvatarURL() });
			}
			if (completions.length > 0) {
				fields.push({ name: "Completers", value: `<@${completions.map(reciept => reciept.userId).join(">, <@")}>` });
			}

			if (fields.length > 0) {
				embed.addFields(fields);
			}

			return embed;
		});
	}

	/** Update the bounty's embed in the bounty board
	 * @param {Guild} guild
	 * @param {Company} company
	 * @param {Sequelize} database
	 */
	async updatePosting(guild, company, database) {
		if (company.bountyBoardId) {
			const poster = await database.models.Hunter.findOne({ where: { userId: this.userId, companyId: this.companyId } });
			return guild.channels.fetch(company.bountyBoardId).then(bountyBoard => {
				return bountyBoard.threads.fetch(this.postingId);
			}).then(async thread => {
				if (thread.archived) {
					await thread.setArchived(false, "Unarchived to update posting");
				}
				thread.edit({ name: this.title });
				return thread.fetchStarterMessage();
			}).then(async posting => {
				this.embed(guild, poster.level, false, company, await database.models.Completion.findAll({ where: { bountyId: this.id } })).then(embed => {
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

	static calculateCompleterReward(posterLevel, slotNumber, showcaseCount) {
		const showcaseMultiplier = 0.25 * showcaseCount + 1;
		return Math.max(2, Math.floor((6 + 0.5 * posterLevel - 3 * slotNumber + 0.5 * slotNumber % 2) * showcaseMultiplier));
	}

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
	Bounty.init({
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
		freezeTableName: true,
		paranoid: true
	});
	return Bounty;
};

module.exports = { Bounty, initModel };
