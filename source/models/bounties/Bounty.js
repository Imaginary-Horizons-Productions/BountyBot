const { EmbedBuilder, Guild } = require('discord.js');
const { DataTypes: { BIGINT, STRING, INTEGER, BOOLEAN }, Model } = require('sequelize');
const { ihpAuthorPayload } = require('../../embedHelpers');
const { Hunter } = require('../users/Hunter');
const { Guild: HunterGuild } = require('../guilds/Guild');
const { database } = require('../../../database');

/** Bounties are user created objectives for other server members to complete */
const bountyModel = {
	id: {
		primaryKey: true,
		type: BIGINT,
		autoIncrement: true
	},
	userId: {
		type: STRING,
		references: {
			model: 'User',
			key: 'id'
		}
	},
	guildId: {
		type: STRING,
		references: {
			model: 'Guild',
			key: 'id'
		}
	},
	postingId: {
		type: STRING,
	},
	slotNumber: {
		type: INTEGER,
		allowNull: false
	},
	isEvergreen: {
		type: BOOLEAN,
		devaultValue: false
	},
	title: {
		type: STRING,
		allowNull: false
	},
	description: {
		type: STRING,
		allowNull: false
	},
	attachmentURL: {
		type: STRING,
		defaultValue: null
	},
	scheduledEventId: {
		type: INTEGER,
		defaultValue: null
	},
	state: { // Allowed values: "open", "completed", "deleted"
		type: STRING,
		defaultValue: "open"
	},
	completedAt: {
		type: INTEGER,
		defaultValue: null
	},
	deletedAt: {
		type: INTEGER,
		defaultValue: null
	},
	editCount: {
		type: INTEGER,
		defaultValue: 0
	}
};
exports.Bounty = class Bounty extends Model {
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
	exports.Bounty.init(bountyModel, {
		sequelize,
		modelName: 'Bounty',
		freezeTableName: true
	});
}
