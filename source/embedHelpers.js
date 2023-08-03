const { EmbedBuilder, Guild, Colors } = require("discord.js");
const fs = require("fs");
const { database } = require("../database");
const { Op } = require("sequelize");
const { Hunter } = require("./models/users/Hunter");
const { Guild: HunterGuild } = require("./models/guilds/Guild");
const { GUILD_XP_COEFFICIENT } = require("./constants");
const { generateTextBar } = require("./helpers");

const discordIconURL = "https://cdn.discordapp.com/attachments/618523876187570187/1110265047516721333/discord-mark-blue.png";
/** @type {import("discord.js").EmbedFooterData[]} */
const discordTips = [
	{ text: "Message starting with @silent don't send notifications; good for when everyone's asleep.", iconURL: discordIconURL },
	{ text: "Surround your message with || to mark it a spoiler (not shown until reader clicks on it).", iconURL: discordIconURL },
	{ text: "Surround a part of your messag with ~~ to add strikethrough styling.", iconURL: discordIconURL },
	{ text: "Don't forget to check slash commands for optional arguments.", iconURL: discordIconURL },
	{ text: "Some slash commands can be used in DMs, others can't.", iconURL: discordIconURL },
	{ text: "Server subscriptions cost more on mobile because the mobile app stores take a cut.", iconURL: discordIconURL }
];
/** @type {import("discord.js").EmbedFooterData[]} */
const applicationSpecificTips = [];
const tipPool = applicationSpecificTips.concat(applicationSpecificTips, discordTips);

exports.ihpAuthorPayload = { name: "Click here to check out the Imaginary Horizons GitHub", iconURL: "https://images-ext-2.discordapp.net/external/8DllSg9z_nF3zpNliVC3_Q8nQNu9J6Gs0xDHP_YthRE/https/cdn.discordapp.com/icons/353575133157392385/c78041f52e8d6af98fb16b8eb55b849a.png", url: "https://github.com/Imaginary-Horizons-Productions" };

/** twice as likely to roll an application specific tip as a discord tip */
exports.randomFooterTip = function () {
	return tipPool[Math.floor(Math.random() * tipPool.length)];
}

exports.buildGuildStatsEmbed = async function (guild) {
	return database.models.Hunter.findAll({ where: { guildId: guild.id, seasonXP: { [Op.gt]: 0 } }, order: [["seasonXP", "DESC"]] }).then(async seasonParticipants => {
		const { xp: guildXPPromise, level: guildLevel, seasonXP, lastSeasonXP, seasonBounties, bountiesLastSeason, seasonToasts, toastsLastSeason } = await database.models.Guild.findByPk(guild.id);
		const guildXP = await guildXPPromise;

		const currentLevelThreshold = Hunter.xpThreshold(guildLevel, GUILD_XP_COEFFICIENT);
		const nextLevelThreshold = Hunter.xpThreshold(guildLevel + 1, GUILD_XP_COEFFICIENT);
		const particpantPercentage = seasonParticipants.length / guild.memberCount * 100;
		const seasonXPDifference = seasonXP - lastSeasonXP;
		const seasonBountyDifference = seasonBounties - bountiesLastSeason;
		const seasonToastDifference = seasonToasts - toastsLastSeason;
		return new EmbedBuilder().setColor(Colors.Blurple)
			.setAuthor(exports.ihpAuthorPayload)
			.setTitle(`${guild.name} is __Level ${guildLevel}__`)
			.setThumbnail(guild.iconURL())
			.setDescription(`${generateTextBar(guildXP - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)}*Next Level:* ${nextLevelThreshold - guildXP} Bounty Hunter Levels`)
			.addFields(
				{ name: "Total Bounty Hunter Level", value: `${guildXP} level${guildXP == 1 ? "" : "s"}`, inline: true },
				{ name: "Participation", value: `${seasonParticipants.length} server members have interacted with BountyBot this season (${particpantPercentage.toPrecision(3)}% of server members)` },
				{ name: `${seasonXP} XP Earned Total (${seasonXPDifference === 0 ? "same as last season" : `${seasonXPDifference > 0 ? `+${seasonXPDifference} more XP` : `${seasonXPDifference * -1} fewer XP`} than last season`})`, value: `${seasonBounties} bounties (${seasonBountyDifference === 0 ? "same as last season" : `${seasonBountyDifference > 0 ? `**+${seasonBountyDifference} more bounties**` : `**${seasonBountyDifference * -1} fewer bounties**`} than last season`})\n${seasonToasts} toasts (${seasonToastDifference === 0 ? "same as last season" : `${seasonToastDifference > 0 ? `**+${seasonToastDifference} more toasts**` : `**${seasonToastDifference * -1} fewer toasts**`} than last season`})` }
			)
			.setFooter(exports.randomFooterTip())
			.setTimestamp()
	});
}

/** Listing XP acquired allows bounty hunters to compare ranking within a server
 * @param {Guild} guild
 * @param {boolean} isSeasonScoreboard
 */
exports.buildScoreboardEmbed = async function (guild, isSeasonScoreboard) {
	const queryParams = { where: { guildId: guild.id } };
	if (isSeasonScoreboard) {
		queryParams.where.seasonXP = { [Op.gt]: 0 };
		queryParams.order = [["seasonXP", "DESC"]];
	} else {
		queryParams.order = [["xp", "DESC"]];
	}

	const hunters = await database.models.Hunter.findAll(queryParams);
	const hunterMembers = await guild.members.fetch({ user: hunters.map(hunter => hunter.userId) });
	const rankmojiArray = (await database.models.GuildRank.findAll({ where: { guildId: guild.id }, order: [["varianceThreshold", "DESC"]] })).map(rank => rank.rankmoji);

	const scorelines = hunters.map(hunter => `${hunter.rank ? `${rankmojiArray[hunter.rank]} ` : ""}#${hunter.seasonPlacement} **${hunterMembers.get(hunter.userId).displayName}** __Level ${hunter.level}__ *${isSeasonScoreboard ? `${hunter.seasonXP} season XP` : `${hunter.xp} XP`}*`).join("\n");
	//TODO handle character overflow

	return new EmbedBuilder().setColor(Colors.Blurple)
		.setAuthor(exports.ihpAuthorPayload)
		.setThumbnail("https://cdn.discordapp.com/attachments/545684759276421120/734094693217992804/scoreboard.png")
		.setTitle(`The ${isSeasonScoreboard ? "Season " : ""}Scoreboard`)
		.setDescription(scorelines || "No Bounty Hunters yet...")
		.setFooter(exports.randomFooterTip())
		.setTimestamp();
}

/** The version embed lists the following: changes in the most recent update, known issues in the most recent update, and links to support the project
 * @param {string} avatarURL
 * @returns {MessageEmbed}
 */
exports.buildVersionEmbed = async function (avatarURL) {
	const data = await fs.promises.readFile('./ChangeLog.md', { encoding: 'utf8' });
	const dividerRegEx = /## .+ Version/g;
	const changesStartRegEx = /\.\d+:/g;
	const knownIssuesStartRegEx = /### Known Issues/g;
	let titleStart = dividerRegEx.exec(data).index;
	changesStartRegEx.exec(data);
	let knownIssuesStart;
	let knownIssueStartResult = knownIssuesStartRegEx.exec(data);
	if (knownIssueStartResult) {
		knownIssuesStart = knownIssueStartResult.index;
	}
	let knownIssuesEnd = dividerRegEx.exec(data).index;

	const embed = new EmbedBuilder().setColor(Colors.Blurple)
		.setAuthor(exports.ihpAuthorPayload)
		.setTitle(data.slice(titleStart + 3, changesStartRegEx.lastIndex))
		.setURL('https://discord.gg/JxqE9EpKt9')
		.setThumbnail('https://cdn.discordapp.com/attachments/545684759276421120/734099622846398565/newspaper.png')
		.setFooter({ text: "Imaginary Horizons Productions", iconURL: "https://cdn.discordapp.com/icons/353575133157392385/c78041f52e8d6af98fb16b8eb55b849a.png" })
		.setTimestamp();

	if (knownIssuesStart && knownIssuesStart < knownIssuesEnd) {
		// Known Issues section found
		embed.setDescription(data.slice(changesStartRegEx.lastIndex, knownIssuesStart))
			.addFields({ name: "Known Issues", value: data.slice(knownIssuesStart + 16, knownIssuesEnd) });
	} else {
		// Known Issues section not found
		embed.setDescription(data.slice(changesStartRegEx.lastIndex, knownIssuesEnd));
	}
	return embed.addFields({ name: "Become a Sponsor", value: "Chip in for server costs or get premium features by sponsoring [{bot} on GitHub]( url goes here )" });
}

/** If the guild has a scoreboard reference channel, update the embed in it
 * @param {HunterGuild} guildProfile
 * @param {Guild} guild
 */
exports.updateScoreboard = function (guildProfile, guild) {
	if (guildProfile.scoreboardChannelId && guildProfile.scoreboardMessageId) {
		guild.channels.fetch(guildProfile.scoreboardChannelId).then(scoreboard => {
			return scoreboard.messages.fetch(guildProfile.scoreboardMessageId);
		}).then(async scoreboardMessage => {
			scoreboardMessage.edit({ embeds: [await exports.buildScoreboardEmbed(guild, guildProfile.scoreboardIsSeasonal)] });
		});
	}
}
