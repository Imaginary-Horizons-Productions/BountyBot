const fs = require("fs");
const { EmbedBuilder, Guild, Colors, TextChannel, Utils } = require("discord.js");
const { Sequelize } = require("sequelize");
const { Hunter } = require("../models/users/Hunter");
const { Company } = require("../models/companies/Company");
const { COMPANY_XP_COEFFICIENT } = require("../constants");
const { generateTextBar } = require("./textUtil");

const discordIconURL = "https://cdn.discordapp.com/attachments/618523876187570187/1110265047516721333/discord-mark-blue.png";
const bountyBotIcon = "https://cdn.discordapp.com/attachments/618523876187570187/1138968614364528791/BountyBotIcon.jpg";
/** @type {import("discord.js").EmbedFooterData[]} */
const discordTips = [
	"Message starting with @silent don't send notifications; good for when everyone's asleep.",
	"Surround your message with || to mark it a spoiler (not shown until reader clicks on it).",
	"Surround a part of your messag with ~~ to add strikethrough styling.",
	"Don't forget to check slash commands for optional arguments.",
	"Some slash commands can be used in DMs, others can't.",
	"Server subscriptions cost more on mobile because the mobile app stores take a cut."
].map(text => ({ text, iconURL: discordIconURL }));
/** @type {import("discord.js").EmbedFooterData[]} */
const bountyBotTips = [
	"You can showcase one of your bounties once a week to increase its rewards.",
	"Send bug reports or feature requests with the \"/feedback\".",
	"Bounties can't be completed until 5 minutes after they've been posted. Don't make them too easy!",
	"You get XP for posting a bounty, but lose that XP if it's taken down before it's completed.",
	"You get XP when your bounties are completed. Thanks for posting!",
	"You get more XP when a bigger group completes your bounties. Thanks for organizing!",
	"Sometimes when you raise a toast to someone, it'll crit and grant you XP too!",
	"Your chance for Critical Toast is lower when repeatedly toasting the same bounty hunters. Spread the love!",
	"Users who can manage BountyBot aren't included in seasonal rewards to avoid conflicts of interest.",
	"Anyone can post a bounty, even you!",
	"Anyone can raise a toast, even you!",
	"The Overjustification Effect means a small reward can be less motivating than no reward.",
	"Manage bounties from within games with the Discord Overlay (default: Shift + Tab)!",
	"Server level is based on total bounty hunter level--higher server level means better evergreen bounty rewards.",
	"A bounty poster cannot complete their own bounty.",
	"Adding a description, image or time to a bounty all add 1 bonus XP for the poster."
].map(text => ({ text, iconURL: bountyBotIcon }));
const tipPool = bountyBotTips.concat(bountyBotTips, discordTips);

/** twice as likely to roll an application specific tip as a discord tip */
function randomFooterTip() {
	return tipPool[Math.floor(Math.random() * tipPool.length)];
}

/**
 * @param {Guild} guild
 * @param {Sequelize} database
 */
async function buildCompanyStatsEmbed(guild, database) {
	const [company] = await database.models.Company.findOrCreate({ where: { id: guild.id } });
	const [currentSeason] = await database.models.Season.findOrCreate({ where: { companyId: guild.id, isCurrentSeason: true } });
	const lastSeason = await database.models.Season.findOne({ where: { companyId: guild.id, isPreviousSeason: true } });
	const participantCount = await database.models.Participation.count({ where: { seasonId: currentSeason.id } });
	const companyXP = await company.xp;
	const currentSeasonXP = await currentSeason.totalXP;
	const lastSeasonXP = await lastSeason?.totalXP ?? 0;

	const currentLevelThreshold = Hunter.xpThreshold(company.level, COMPANY_XP_COEFFICIENT);
	const nextLevelThreshold = Hunter.xpThreshold(company.level + 1, COMPANY_XP_COEFFICIENT);
	const particpantPercentage = participantCount / guild.memberCount * 100;
	const seasonXPDifference = currentSeasonXP - lastSeasonXP;
	const seasonBountyDifference = currentSeason.bountiesCompleted - (lastSeason?.bountiesCompleted ?? 0);
	const seasonToastDifference = currentSeason.toastsRaised - (lastSeason?.toastsRaised ?? 0);
	return new EmbedBuilder().setColor(Colors.Blurple)
		.setAuthor(module.exports.ihpAuthorPayload)
		.setTitle(`${guild.name} is __Level ${company.level}__`)
		.setThumbnail(guild.iconURL())
		.setDescription(`${generateTextBar(companyXP - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)}*Next Level:* ${nextLevelThreshold - companyXP} Bounty Hunter Levels`)
		.addFields(
			{ name: "Total Bounty Hunter Level", value: `${companyXP} level${companyXP == 1 ? "" : "s"}`, inline: true },
			{ name: "Participation", value: `${participantCount} server members have interacted with BountyBot this season (${particpantPercentage.toPrecision(3)}% of server members)` },
			{ name: `${currentSeasonXP} XP Earned Total (${seasonXPDifference === 0 ? "same as last season" : `${seasonXPDifference > 0 ? `+${seasonXPDifference} more XP` : `${seasonXPDifference * -1} fewer XP`} than last season`})`, value: `${currentSeason.bountiesCompleted} bounties (${seasonBountyDifference === 0 ? "same as last season" : `${seasonBountyDifference > 0 ? `**+${seasonBountyDifference} more bounties**` : `**${seasonBountyDifference * -1} fewer bounties**`} than last season`})\n${currentSeason.toastsRaised} toasts (${seasonToastDifference === 0 ? "same as last season" : `${seasonToastDifference > 0 ? `**+${seasonToastDifference} more toasts**` : `**${seasonToastDifference * -1} fewer toasts**`} than last season`})` }
		)
		.setFooter(randomFooterTip())
		.setTimestamp()
}

/** A seasonal scoreboard orders a company's hunters by their seasonal xp
 * @param {Guild} guild
 * @param {Sequelize} database
 */
async function buildSeasonalScoreboardEmbed(guild, database) {
	const [company] = await database.models.Company.findOrCreate({ where: { id: guild.id } });
	const [season] = await database.models.Season.findOrCreate({ where: { companyId: company.id, isCurrentSeason: true } });
	const participations = await database.models.Participation.findAll({ where: { seasonId: season.id }, order: [["xp", "DESC"]] });

	const hunterMembers = await guild.members.fetch({ user: participations.map(participation => participation.userId) });
	const rankmojiArray = (await database.models.Rank.findAll({ where: { companyId: guild.id }, order: [["varianceThreshold", "DESC"]] })).map(rank => rank.rankmoji);

	const scorelines = [];
	for (const participation of participations) {
		if (participation.xp > 0) {
			const hunter = await participation.hunter;
			scorelines.push(`${hunter.rank !== null ? `${rankmojiArray[hunter.rank]} ` : ""}#${participation.placement} **${hunterMembers.get(participation.userId).displayName}** __Level ${hunter.level}__ *${participation.xp} season XP*`);
		}
	}
	let description = "";
	const andMore = "…and more";
	const maxDescriptionLength = 2048 - andMore.length;
	for (const scoreline of scorelines) {
		if (description.length + scoreline.length <= maxDescriptionLength) {
			description += `${scoreline}\n`;
		} else {
			description += andMore;
			break;
		}
	}

	return new EmbedBuilder().setColor(Colors.Blurple)
		.setAuthor(module.exports.ihpAuthorPayload)
		.setThumbnail("https://cdn.discordapp.com/attachments/545684759276421120/734094693217992804/scoreboard.png")
		.setTitle("The Season Scoreboard")
		.setDescription(description || "No Bounty Hunters yet…")
		.setFooter(randomFooterTip())
		.setTimestamp();
}

/** An overall scoreboard orders a company's hunters by total xp
 * @param {Guild} guild
 * @param {Sequelize} database
 */
async function buildOverallScoreboardEmbed(guild, database) {
	const hunters = await database.models.Hunter.findAll({ where: { companyId: guild.id }, order: [["xp", "DESC"]] });

	const hunterMembers = await guild.members.fetch({ user: hunters.map(hunter => hunter.userId) });
	const rankmojiArray = (await database.models.Rank.findAll({ where: { companyId: guild.id }, order: [["varianceThreshold", "DESC"]] })).map(rank => rank.rankmoji);

	const scorelines = [];
	for (const hunter of hunters) {
		if (hunter.xp > 0) {
			scorelines.push(`${hunter.rank !== null ? `${rankmojiArray[hunter.rank]} ` : ""} **${hunterMembers.get(hunter.userId).displayName}** __Level ${hunter.level}__ *${hunter.xp} XP*`);
		}
	}
	let description = "";
	const andMore = "…and more";
	const maxDescriptionLength = 2048 - andMore.length;
	for (const scoreline of scorelines) {
		if (description.length + scoreline.length <= maxDescriptionLength) {
			description += `${scoreline}\n`;
		} else {
			description += andMore;
			break;
		}
	}

	return new EmbedBuilder().setColor(Colors.Blurple)
		.setAuthor(module.exports.ihpAuthorPayload)
		.setThumbnail("https://cdn.discordapp.com/attachments/545684759276421120/734094693217992804/scoreboard.png")
		.setTitle("The Scoreboard")
		.setDescription(description || "No Bounty Hunters yet...")
		.setFooter(randomFooterTip())
		.setTimestamp();
}

/** Build an embed mentioning if a festival is running, the next raffle date and the raffle rewards
 * @param {TextChannel} channel
 * @param {Guild} guild
 * @param {Company} company
 */
async function buildServerBonusesEmbed(channel, guild, company) {
	const { displayColor, displayName } = await guild.members.fetch(guild.client.user.id);
	const embed = new EmbedBuilder().setColor(displayColor)
		.setAuthor({ name: guild.name, iconURL: guild.iconURL() })
		.setTitle(`${displayName} Server Bonuses`)
		.setThumbnail('https://cdn.discordapp.com/attachments/545684759276421120/734097732897079336/calendar.png')
		.setDescription(`There is ${company.festivalMultiplier != 1 ? '' : 'not '}an XP multiplier festival currently active${company.festivalMultiplier == 1 ? '' : ` for ${company.festivalMultiplierString()}`}.`)
		.setFooter(randomFooterTip())
		.setTimestamp();
	if (company.nextRaffleString) {
		embed.addFields([{ name: "Next Raffle", value: Utils.cleanContent(`The next raffle will be on ${company.nextRaffleString}!`, channel) }]);
	}

	return embed;
}

/**
 * @param {Guild} guild
 * @param {GuildMember} member
 * @param {Hunter} hunter
 * @param {Sequelize} database
 */
async function buildModStatsEmbed(guild, member, hunter, database) {
	const embed = new EmbedBuilder().setColor(member.displayColor)
		.setAuthor({ name: guild.name, iconURL: guild.iconURL() })
		.setTitle(`Moderation Stats: ${member.user.tag}`)
		.setThumbnail(member.user.avatarURL())
		.setDescription(`Display Name: **${member.displayName}** (id: *${member.id}*)\nAccount created on: ${member.user.createdAt.toDateString()}\nJoined server on: ${member.joinedAt.toDateString()}`)
		.addFields(
			{ name: "Bans", value: `Currently Banned: ${hunter.isBanned ? "Yes" : "No"}\nHas Been Banned: ${hunter.hasBeenBanned ? "Yes" : "No"}`, inline: true },
			{ name: "Disqualifications", value: `${await database.models.Participation.sum("dqCount", { where: { companyId: guild.id, userId: member.id } }) ?? 0} season DQs`, inline: true },
			{ name: "Penalties", value: `${hunter.penaltyCount} penalties (${hunter.penaltyPointTotal} points total)`, inline: true }
		)
		.setFooter(randomFooterTip())
		.setTimestamp();

	let bountyHistory = "";
	const lastFiveBounties = await database.models.Bounty.findAll({ where: { userId: member.id, companyId: guild.id, state: "completed" }, order: [["completedAt", "DESC"]], limit: 5 });
	lastFiveBounties.forEach(async bounty => {
		const completions = await database.models.Completion.findAll({ where: { bountyId: bounty.id } });
		bountyHistory += `__${bounty.title}__${bounty.description !== null ? ` ${bounty.description}` : ""}\n${bounty.xpAwarded} XP per completer\nCompleters: <@${completions.map(completion => completion.userId).join('>, <@')
			}>\n\n`;
	})

	if (bountyHistory === "") {
		bountyHistory = "No recent bounties";
	}
	return embed.addFields({ name: "Last 5 Completed Bounties Created by this User", value: bountyHistory });
}

/** The version embed lists the following: changes in the most recent update, known issues in the most recent update, and links to support the project
 * @returns {MessageEmbed}
 */
async function buildVersionEmbed() {
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
		.setAuthor(module.exports.ihpAuthorPayload)
		.setTitle(data.slice(titleStart + 3, changesStartRegEx.lastIndex))
		.setURL('https://discord.gg/JxqE9EpKt9')
		.setThumbnail('https://cdn.discordapp.com/attachments/545684759276421120/734099622846398565/newspaper.png')
		.setFooter(randomFooterTip())
		.setTimestamp();

	if (knownIssuesStart && knownIssuesStart < knownIssuesEnd) {
		// Known Issues section found
		embed.setDescription(data.slice(changesStartRegEx.lastIndex, knownIssuesStart))
			.addFields({ name: "Known Issues", value: data.slice(knownIssuesStart + 16, knownIssuesEnd) });
	} else {
		// Known Issues section not found
		embed.setDescription(data.slice(changesStartRegEx.lastIndex, knownIssuesEnd));
	}
	return embed.addFields({ name: "Become a Sponsor", value: "Chip in for server costs or get premium features by sponsoring [BountyBot on GitHub](https://github.com/Imaginary-Horizons-Productions/BountyBot)" });
}

/** If the guild has a scoreboard reference channel, update the embed in it
 * @param {Company} company
 * @param {Guild} guild
 * @param {Sequelize} database
 */
function updateScoreboard(company, guild, database) {
	if (company.scoreboardChannelId && company.scoreboardMessageId) {
		guild.channels.fetch(company.scoreboardChannelId).then(scoreboard => {
			return scoreboard.messages.fetch(company.scoreboardMessageId);
		}).then(async scoreboardMessage => {
			scoreboardMessage.edit({ embeds: [company.scoreboardIsSeasonal ? await buildSeasonalScoreboardEmbed(guild, database) : await buildOverallScoreboardEmbed(guild, database)] });
		});
	}
}

module.exports = {
	ihpAuthorPayload: { name: "Click here to check out the Imaginary Horizons GitHub", iconURL: "https://images-ext-2.discordapp.net/external/8DllSg9z_nF3zpNliVC3_Q8nQNu9J6Gs0xDHP_YthRE/https/cdn.discordapp.com/icons/353575133157392385/c78041f52e8d6af98fb16b8eb55b849a.png", url: "https://github.com/Imaginary-Horizons-Productions" },
	randomFooterTip,
	buildCompanyStatsEmbed,
	buildSeasonalScoreboardEmbed,
	buildOverallScoreboardEmbed,
	buildServerBonusesEmbed,
	buildModStatsEmbed,
	buildVersionEmbed,
	updateScoreboard
};
