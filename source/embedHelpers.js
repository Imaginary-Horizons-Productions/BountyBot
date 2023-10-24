const { EmbedBuilder, Guild, Colors } = require("discord.js");
const fs = require("fs");
const { database } = require("../database");
const { Op } = require("sequelize");
const { Hunter } = require("./models/users/Hunter");
const { Company } = require("./models/companies/Company");
const { COMPANY_XP_COEFFICIENT } = require("./constants");
const { generateTextBar } = require("./helpers");

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
const applicationSpecificTips = [
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
	"A bounty poster cannot complete their own bounty."
].map(text => ({ text, iconURL: bountyBotIcon }));
const tipPool = applicationSpecificTips.concat(applicationSpecificTips, discordTips);

/** twice as likely to roll an application specific tip as a discord tip */
function randomFooterTip() {
	return tipPool[Math.floor(Math.random() * tipPool.length)];
}

/** @param {Guild} guild */
async function buildCompanyStatsEmbed(guild) {
	const [company] = await database.models.Company.findOrCreate({ where: { id: guild.id } });
	const [currentSeason] = await database.models.Season.findOrCreate({ where: { companyId: guild.id, isCurrentSeason: true } });
	const lastSeason = await database.models.Season.findOne({ where: { companyId: guild.id, isPreviousSeason: true } });
	const seasonParticipants = (await database.models.SeasonParticipation.findAll({ where: { seasonId: currentSeason.id }, include: database.models.SeasonParticipation.Hunter, order: [["xp", "DESC"]] })).map(participation => participation.Hunter);
	const companyXP = await company.xp;
	const currentSeasonXP = await currentSeason.totalXP;
	const lastSeasonXP = await lastSeason?.totalXP ?? 0;

	const currentLevelThreshold = Hunter.xpThreshold(company.level, COMPANY_XP_COEFFICIENT);
	const nextLevelThreshold = Hunter.xpThreshold(company.level + 1, COMPANY_XP_COEFFICIENT);
	const particpantPercentage = seasonParticipants.length / guild.memberCount * 100;
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
			{ name: "Participation", value: `${seasonParticipants.length} server members have interacted with BountyBot this season (${particpantPercentage.toPrecision(3)}% of server members)` },
			{ name: `${currentSeasonXP} XP Earned Total (${seasonXPDifference === 0 ? "same as last season" : `${seasonXPDifference > 0 ? `+${seasonXPDifference} more XP` : `${seasonXPDifference * -1} fewer XP`} than last season`})`, value: `${currentSeason.bountiesCompleted} bounties (${seasonBountyDifference === 0 ? "same as last season" : `${seasonBountyDifference > 0 ? `**+${seasonBountyDifference} more bounties**` : `**${seasonBountyDifference * -1} fewer bounties**`} than last season`})\n${currentSeason.toastsRaised} toasts (${seasonToastDifference === 0 ? "same as last season" : `${seasonToastDifference > 0 ? `**+${seasonToastDifference} more toasts**` : `**${seasonToastDifference * -1} fewer toasts**`} than last season`})` }
		)
		.setFooter(randomFooterTip())
		.setTimestamp()
}

/** A seasonal scoreboard orders a company's hunters by their seasonal xp
 * @param {Guild} guild
 */
async function buildSeasonalScoreboardEmbed(guild) {
	const [company] = await database.models.Company.findOrCreate({ where: { id: guild.id } });
	const [season] = await database.models.Season.findOrCreate({ where: { companyId: company.id, isCurrentSeason: true } });
	const participations = await database.models.SeasonParticipation.findAll({ where: { seasonId: season.id }, include: database.models.SeasonParticipation.Hunter, order: [["xp", "DESC"]] });

	const hunterMembers = await guild.members.fetch({ user: participations.map(participation => participation.userId) });
	const rankmojiArray = (await database.models.CompanyRank.findAll({ where: { companyId: guild.id }, order: [["varianceThreshold", "DESC"]] })).map(rank => rank.rankmoji);

	const scorelines = participations.map(participation => `${participation.Hunter.rank ? `${rankmojiArray[participation.Hunter.rank]} ` : ""}#${participation.placement} **${hunterMembers.get(participation.userId).displayName}** __Level ${participation.Hunter.level}__ *${participation.xp} season XP*`);
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
 */
async function buildOverallScoreboardEmbed(guild) {
	const hunters = await database.models.Hunter.findAll({ where: { companyId: guild.id }, order: [["xp", "DESC"]] });

	const hunterMembers = await guild.members.fetch({ user: hunters.map(hunter => hunter.userId) });
	const rankmojiArray = (await database.models.CompanyRank.findAll({ where: { companyId: guild.id }, order: [["varianceThreshold", "DESC"]] })).map(rank => rank.rankmoji);

	const scorelines = hunters.map(hunter => `${hunter.rank ? `${rankmojiArray[hunter.rank]} ` : ""} **${hunterMembers.get(hunter.userId).displayName}** __Level ${hunter.level}__ *${hunter.xp} XP*`);
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
 * @param {Company} company
 * @param {Guild} guild
 */
function updateScoreboard(company, guild) {
	if (company.scoreboardChannelId && company.scoreboardMessageId) {
		guild.channels.fetch(company.scoreboardChannelId).then(scoreboard => {
			return scoreboard.messages.fetch(company.scoreboardMessageId);
		}).then(async scoreboardMessage => {
			scoreboardMessage.edit({ embeds: [company.scoreboardIsSeasonal ? await buildSeasonalScoreboardEmbed(guild) : await buildOverallScoreboardEmbed(guild)] });
		});
	}
}

module.exports = {
	ihpAuthorPayload: { name: "Click here to check out the Imaginary Horizons GitHub", iconURL: "https://images-ext-2.discordapp.net/external/8DllSg9z_nF3zpNliVC3_Q8nQNu9J6Gs0xDHP_YthRE/https/cdn.discordapp.com/icons/353575133157392385/c78041f52e8d6af98fb16b8eb55b849a.png", url: "https://github.com/Imaginary-Horizons-Productions" },
	randomFooterTip,
	buildCompanyStatsEmbed,
	buildSeasonalScoreboardEmbed,
	buildOverallScoreboardEmbed,
	buildVersionEmbed,
	updateScoreboard
};
