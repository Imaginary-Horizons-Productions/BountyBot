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
	 * @param {Hunter?} hunter
	 * @param {HunterGuild?} hunterGuild
	 */
	asEmbed(guild, hunter, hunterGuild) {
		return guild.members.fetch(this.userId).then(async author => {
			if (!hunter) {
				hunter = await database.models.Hunter.findOne({ where: { userId: this.userId, guildId: this.guildId } });
			}
			if (!hunterGuild) {
				hunterGuild = await database.models.Guild.findByPk(this.guildId);
			}

			const embed = new EmbedBuilder().setColor(author.displayColor)
				.setAuthor(ihpAuthorPayload)
				.setThumbnail('https://cdn.discordapp.com/attachments/545684759276421120/734093574031016006/bountyboard.png')
				.setTitle(this.title)
				.setDescription(this.description)
				.addFields(
					{ name: "Reward", value: `${hunter.slotWorth(this.slotNumber)} XP${hunterGuild.eventMultiplierString()}`, inline: true }
				)
				.setTimestamp();

			if (this.attachmentURL) {
				embed.setImage(this.attachmentURL);
			}
			if (this.state === "completed") {
				const completions = await database.models.Completion.findAll({ where: { bountyId: this.id } });
				embed.addField("Completed By", `<@${completions.map(reciept => reciept.userId).join(">, <@")}>`);
			}
			if (this.isEvergreen) {
				embed.setFooter({ text: `Evergreen Bounty #${this.slotNumber}`, iconURL: author.user.displayAvatarURL() });
			} else {
				embed.setFooter({ text: `${author.displayName}'s #${this.slotNumber} Bounty`, iconURL: author.user.displayAvatarURL() });
			}

			return embed;
		});
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
		deletedAt: { //TODO convert to paranoid
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
