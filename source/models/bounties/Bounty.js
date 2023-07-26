const { EmbedBuilder, Guild } = require('discord.js');
const { DataTypes, Model } = require('sequelize');
const { ihpAuthorPayload } = require('../../embedHelpers');
const { Hunter } = require('../users/Hunter');
const { Guild: HunterGuild } = require('../guilds/Guild');
const { database } = require('../../../database');

/** Bounties are user created objectives for other server members to complete */
exports.Bounty = class extends Model {
	/** Generate an embed for the given bounty
	 * @param {Guild} guild
	 * @param {Hunter?} poster
	 * @param {HunterGuild?} hunterGuild
	 */
	asEmbed(guild, poster, hunterGuild) {
		return guild.members.fetch(this.userId).then(async author => {
			if (!poster) {
				poster = await database.models.Hunter.findOne({ where: { userId: this.userId, guildId: this.guildId } });
			}
			if (!hunterGuild) {
				hunterGuild = await database.models.Guild.findByPk(this.guildId);
			}

			const embed = new EmbedBuilder().setColor(author.displayColor)
				.setAuthor(ihpAuthorPayload)
				.setThumbnail('https://cdn.discordapp.com/attachments/545684759276421120/734093574031016006/bountyboard.png')
				.setTitle(this.title)
				.setDescription(this.description)
				.setTimestamp();

			if (this.attachmentURL) {
				embed.setImage(this.attachmentURL);
			}
			if (this.scheduledEventId) {
				const event = await guild.scheduledEvents.fetch(this.scheduledEventId);
				embed.addFields({ name: "Time", value: `<t:${event.scheduledStartTimestamp / 1000}> - <t:${event.scheduledEndTimestamp / 1000}>` });
			}
			const completions = await database.models.Completion.findAll({ where: { bountyId: this.id } });
			if (completions.length > 0) {
				embed.addFields({ name: "Completers", value: `<@${completions.map(reciept => reciept.userId).join(">, <@")}>` });
			}
			embed.addFields(
				{ name: "Reward", value: `${poster.slotWorth(this.slotNumber)} XP${hunterGuild.eventMultiplierString()}`, inline: true }
			)

			if (this.isEvergreen) {
				embed.setFooter({ text: `Evergreen Bounty #${this.slotNumber}`, iconURL: author.user.displayAvatarURL() });
			} else {
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
				thread.edit({name: this.title});
				return thread.fetchStarterMessage();
			}).then(posting => {
				this.asEmbed(guild, poster, guildProfile).then(embed => {
					posting.edit({ embeds: [embed] })
				})
			})
		}
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
			type: DataTypes.INTEGER,
			defaultValue: null
		},
		deletedAt: { //TODO #8 convert to paranoid
			type: DataTypes.INTEGER,
			defaultValue: null
		},
		editCount: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		}
	}, {
		sequelize,
		modelName: 'Bounty',
		freezeTableName: true
	});
}
