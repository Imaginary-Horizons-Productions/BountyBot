const { DataTypes, Model } = require('sequelize');

/** Guild information and bot settings */
exports.Guild = class extends Model {
	eventMultiplierString() {
		if (this.eventMultiplier != 1) {
			return ` ***x${this.eventMultiplier}***`;
		} else {
			return '';
		}
	}

	// eventInfoBuilder(channel, guild, useManagerTips = false) {
	// 	// Build an embed mentioning if an event is running, the next raffle date and the raffle rewards
	// 	const { displayColor, displayName } = guild.me;
	// 	const { prefix, text, url } = tipBuilder(this.maxSimBounties, guild.channels.resolve(this.pinChannelId), useManagerTips);
	// 	let embed = new MessageEmbed().setColor(displayColor)
	// 		.setAuthor({ name: prefix + text, iconURL: guild.client.user.displayAvatarURL(), url })
	// 		.setTitle(`${displayName} Event Info`)
	// 		.setThumbnail('https://cdn.discordapp.com/attachments/545684759276421120/734097732897079336/calendar.png')
	// 		.setDescription(`There is ${this.eventMultiplier != 1 ? '' : 'not '}an XP multiplier event currently active${this.eventMultiplier == 1 ? '' : ` for ${this.eventMultiplierString()}`}.`)
	// 		.setFooter({ text: guild.name, iconURL: guild.iconURL() })
	// 		.setTimestamp();
	// 	if (this.raffleDates) {
	// 		embed.addField(`Next Raffle`, Util.cleanContent(`The next raffle will be on ${this.raffleDates}!`, channel));
	// 	} else {
	// 		embed.addField(`Next Raffle`, `The next raffle has not been scheduled yet.`);
	// 	}
	// 	if (this.rewards.length > 0) {
	// 		embed.addField(`Raffle Rewards`, Util.cleanContent(this.rewardStringBuilder(), channel));
	// 	}

	// 	return embed;
	// }

	// /** Build the list of rewards
	// * @param {string} guildId
	// * @param {number} characterLimit
	// * @returns {string}
	// */
	// rewardStringBuilder(characterLimit = 1024) {
	// 	let overflowText = "...and more";
	// 	characterLimit -= overflowText.length;
	// 	let rewardString = "";
	// 	if (rewards.length == 0) {
	// 		rewardString += "There are no rewards posted (yet).";
	// 	} else {
	// 		for (let i = 0; i < this.rewards.length; i += 1) {
	// 			let singleReward = `__${i + 1}__: ${this.rewards[i]}\n`;
	// 			if (characterLimit - singleReward.length > 0) {
	// 				rewardString += singleReward;
	// 				characterLimit -= singleReward.length;
	// 			} else {
	// 				rewardString += overflowText;
	// 				break;
	// 			}
	// 		}
	// 	}
	// 	return rewardString;
	// }
}

exports.initModel = function (sequelize) {
	exports.Guild.init({
		id: {
			primaryKey: true,
			type: DataTypes.STRING,
			allowNull: false
		},
		xp: {
			type: DataTypes.VIRTUAL,
			async get() {
				return await sequelize.models.Hunter.sum("level", { where: { guildId: this.id } });
			}
		},
		level: {
			type: DataTypes.INTEGER,
			defaultValue: 1
		},
		announcementPrefix: {
			type: DataTypes.STRING,
			defaultValue: '@here'
		},
		disableBoostXP: {
			type: DataTypes.BOOLEAN,
			defaultValue: true
		},
		maxSimBounties: {
			type: DataTypes.INTEGER,
			defaultValue: 5
		},
		backupTimer: {
			type: DataTypes.BIGINT,
			defaultValue: 3600000
		},
		bountyBoardId: {
			type: DataTypes.STRING,
			defaultValue: ''
		},
		scoreId: {
			type: DataTypes.STRING,
			defaultValue: ''
		},
		raffleDate: {
			type: DataTypes.STRING,
			defaultValue: ''
		},
		eventMultiplier: {
			type: DataTypes.INTEGER,
			defaultValue: 1
		},
		xpCoefficient: {
			type: DataTypes.INTEGER,
			defaultValue: 3
		},
		seasonXP: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		seasonBounties: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		seasonToasts: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		resetSchedulerId: {
			type: DataTypes.STRING,
			defaultValue: ""
		},
		lastSeasonXP: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		bountiesLastSeason: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		},
		toastsLastSeason: {
			type: DataTypes.BIGINT,
			defaultValue: 0
		}
	}, {
		sequelize,
		modelName: 'Guild',
		freezeTableName: true
	});
}
