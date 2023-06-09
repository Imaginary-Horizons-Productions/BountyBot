const { DataTypes: { STRING, BIGINT, INTEGER, BOOLEAN }, Model } = require('sequelize');

/** This class stores information for bot users on a specific guild */
const hunterModel = {
	userId: {
		primaryKey: true,
		type: STRING,
		allowNull: false,
		references: {
			model: 'User'
		}
	},
	guildId: {
		primaryKey: true,
		type: STRING,
		allowNull: false,
		references: {
			model: 'Guild'
		}
	},
	level: {
		type: BIGINT,
		defaultValue: 1
	},
	xp: {
		type: BIGINT,
		defaultValue: 0
	},
	seasonXP: {
		type: BIGINT,
		defaultValue: 0
	},
	rank: {
		type: STRING
	},
	lastRank: {
		type: STRING
	},
	seasonPlacement: {
		type: INTEGER,
		defaultValue: 0
	},
	mineFinished: {
		type: BIGINT,
		defaultValue: 0
	},
	othersFinished: {
		type: BIGINT,
		defaultValue: 0
	},
	toastsRaised: {
		type: BIGINT,
		defaultValue: 0
	},
	toastsReceived: {
		type: BIGINT,
		defaultValue: 0
	},
	tabooCount: {
		type: BIGINT,
		defaultValue: 0
	},
	isBanned: {
		type: BOOLEAN,
		defaultValue: false
	},
	hasBeenBanned: {
		type: BOOLEAN,
		defaultValue: false
	},
	isDQ: {
		type: BOOLEAN,
		defaultValue: false
	},
	seasonDQCount: {
		type: BIGINT,
		defaultValue: 0
	},
	penaltyCount: {
		type: BIGINT,
		defaultValue: 0
	},
	penaltyPointTotal: {
		type: BIGINT,
		defaultValue: 0
	}
};
exports.Hunter = class Hunter extends Model {
	static xpThreshold(level, xpCoefficient) {
		// xp = xpCoefficient*(level - 1)^2
		return xpCoefficient * (level - 1) ** 2;
	}

	maxSlots(maxSimBounties) {
		let slots = 1 + Math.floor(this.level / 12) * 2;
		let remainder = this.level % 12;
		if (remainder >= 3) {
			slots++;
			remainder -= 3;
		}
		if (remainder >= 7) {
			slots++;
		}
		return Math.min(slots, maxSimBounties);
	}

	// slotWorth(slotNum) {
	// 	return Math.floor(6 + 0.5 * this.level - 3 * slotNum + 0.5 * slotNum % 2);
	// }

	// myModDetails(guild, member, { maxSimBounties, pinChannelId }, lastFiveBounties) {
	// 	const { prefix, text, url } = tipBuilder(maxSimBounties, guild.channels.resolve(pinChannelId), true);
	// 	let embed = new MessageEmbed().setColor(member.displayColor)
	// 		.setAuthor({ name: prefix + text, iconURL: guild.client.user.displayAvatarURL(), url })
	// 		.setTitle(`Moderation Stats: ${member.user.tag}`)
	// 		.setThumbnail(member.user.avatarURL())
	// 		.setDescription(`Display Name: **${member.displayName}** (id: *${member.id}*)\nAccount created on: ${member.user.createdAt.toDateString()}\nJoined server on: ${member.joinedAt.toDateString()}`)
	// 		.addField(`Bans`, `Currently Banned: ${this.isBanned ? "Yes" : "No"}\nHas Been Banned: ${this.hasBeenBanned ? "Yes" : "No"}`, true)
	// 		.addField(`Disqualifications`, `${this.seasonDQCount} season DQs`, true)
	// 		.addField(`Penalties`, `${this.penaltyCount} penalties (${this.penaltyPointCount} points total)`, true)
	// 		.addField(`Taboo Filter`, `${this.tabooCount} infractions`, true)
	// 		.setFooter({ text: guild.name, iconURL: guild.iconURL() })
	// 		.setTimestamp();

	// 	let bountyHistory = "";
	// 	lastFiveBounties.forEach(bounty => {
	// 		bountyHistory += `__${bounty.title}__ ${bounty.description}\n${bounty.xpAwarded} XP per completer\nCompleters: <@${bounty.completers.join('>, <@')}>\n\n`;
	// 	})

	// 	if (bountyHistory === "") {
	// 		bountyHistory = "No recent bounties";
	// 	}
	// 	return embed.addField("Last 5 Completed Bounties Created by this User", bountyHistory);
	// }

	levelUpReward(level, maxSlots, futureReward = true) {
		let text = "";
		if (level % 2) {
			text += `Your bounties in odd-numbered slots ${futureReward ? "will increase" : "have increased"} in value.`;
		} else {
			text += `Your bounties in even-numbered slots ${futureReward ? "will increase" : "have increased"} in value.`;
		}
		const currentSlots = this.maxSlots(maxSlots);
		if (currentSlots < maxSlots) {
			if (level == 3 + 12 * Math.floor((currentSlots - 2) / 2) + 7 * ((currentSlots - 2) % 2)) {
				text += ` You ${futureReward ? "will" : "have"} unlock${futureReward ? "" : "ed"} bounty slot #${currentSlots}.`;
			};
		}
		return text;
	}
}

exports.initModel = function (sequelize) {
	exports.Hunter.init(hunterModel, {
		sequelize,
		modelName: 'Hunter',
		freezeTableName: true
	});
}
