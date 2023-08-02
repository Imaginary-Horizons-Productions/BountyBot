﻿const { EmbedBuilder, Guild } = require('discord.js');
const { DataTypes, Model } = require('sequelize');
const { ihpAuthorPayload } = require('../../embedHelpers');
const { Guild: HunterGuild } = require('../guilds/Guild');
const { database } = require('../../../database');

/** Bounties are user created objectives for other server members to complete */
exports.Bounty = class extends Model {
	/** Generate an embed for the given bounty
	 * @param {Guild} guild
	 * @param {number} posterLevel
	 * @param {string} eventMultiplierString
	 */
	asEmbed(guild, posterLevel, eventMultiplierString) {
		return guild.members.fetch(this.userId).then(async author => {
			const thumbnails = {
				open: "https://cdn.discordapp.com/attachments/545684759276421120/734093574031016006/bountyboard.png",
				complete: "https://cdn.discordapp.com/attachments/545684759276421120/734092918369026108/completion.png",
				deleted: "https://cdn.discordapp.com/attachments/545684759276421120/734093574031016006/bountyboard.png"
			};
			const embed = new EmbedBuilder().setColor(author.displayColor)
				.setAuthor(ihpAuthorPayload)
				.setThumbnail(thumbnails[this.state])
				.setTitle(this.state == "complete" ? `Bounty Complete! ${this.title}` : this.title)
				.setDescription(this.description)
				.setTimestamp();

			if (this.attachmentURL) {
				embed.setImage(this.attachmentURL);
			}
			if (this.scheduledEventId) {
				const event = await guild.scheduledEvents.fetch(this.scheduledEventId);
				embed.addFields({ name: "Time", value: `<t:${event.scheduledStartTimestamp / 1000}> - <t:${event.scheduledEndTimestamp / 1000}>` });
			}
			embed.addFields(
				{ name: "Reward", value: `${exports.Bounty.slotWorth(posterLevel, this.slotNumber)} XP${eventMultiplierString}`, inline: true }
			)

			if (this.isEvergreen) {
				embed.setFooter({ text: `Evergreen Bounty #${this.slotNumber}`, iconURL: author.user.displayAvatarURL() });
			} else {
				const completions = await database.models.Completion.findAll({ where: { bountyId: this.id } });
				if (completions.length > 0) {
					embed.addFields({ name: "Completers", value: `<@${completions.map(reciept => reciept.userId).join(">, <@")}>` });
				}
				embed.setFooter({ text: `${author.displayName}'s #${this.slotNumber} Bounty`, iconURL: author.user.displayAvatarURL() });
			}

			return embed;
		});
	}

	/** Update the bounty's embed in the bounty board
	 * @param {Guild} guild
	 * @param {HunterGuild} guildProfile
	 */
	async updatePosting(guild, guildProfile) {
		if (guildProfile.bountyBoardId) {
			const poster = await database.models.Hunter.findOne({ where: { userId: this.userId, guildId: this.guildId } });
			guild.channels.fetch(guildProfile.bountyBoardId).then(bountyBoard => {
				return bountyBoard.threads.fetch(this.postingId);
			}).then(thread => {
				thread.edit({ name: this.title });
				return thread.fetchStarterMessage();
			}).then(posting => {
				this.asEmbed(guild, poster.level, guildProfile.eventMultiplierString()).then(embed => {
					posting.edit({ embeds: [embed] })
				})
			})
		}
	}

	static slotWorth(posterLevel, slotNumber) {
		return Math.max(2, Math.floor(6 + 0.5 * posterLevel - 3 * slotNumber + 0.5 * slotNumber % 2));
	}
}

exports.initModel = function (sequelize) {
	exports.Bounty.init({
		id: {
			primaryKey: true,
			type: DataTypes.BIGINT,
			autoIncrement: true
		},
		userId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		guildId: {
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
		description: {
			type: DataTypes.STRING,
			allowNull: false
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
		modelName: 'Bounty',
		freezeTableName: true,
		paranoid: true
	});
}
