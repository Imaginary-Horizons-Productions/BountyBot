const fs = require("fs");
const { EmbedBuilder, Guild, Colors } = require("discord.js");
const { Sequelize } = require("sequelize");
const { MAX_EMBED_DESCRIPTION_LENGTH } = require("../constants");
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
	"Adding a description, image or time to a bounty all add 1 bonus XP for the poster.",
	"Bounty posters have double the chance to find items compared to completers."
].map(text => ({ text, iconURL: bountyBotIcon }));
const tipPool = bountyBotTips.concat(bountyBotTips, discordTips);

/** twice as likely to roll an application specific tip as a discord tip */
function randomFooterTip() {
	return tipPool[Math.floor(Math.random() * tipPool.length)];
}

/** A seasonal scoreboard orders a company's hunters by their seasonal xp
 * @param {Guild} guild
 * @param {typeof import("../logic")} logicLayer
 */
async function buildSeasonalScoreboardEmbed(guild, logicLayer) {
	const [company] = await logicLayer.companies.findOrCreateCompany(guild.id);
	const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(company.id);
	const participations = await logicLayer.seasons.findSeasonParticipations(season.id);

	const hunterMembers = await guild.members.fetch({ user: participations.map(participation => participation.userId) });
	const rankmojiArray = (await logicLayer.ranks.findAllRanks(guild.id, "descending")).map(rank => rank.rankmoji);

	const scorelines = [];
	for (const participation of participations) {
		if (participation.xp > 0) {
			const hunter = await participation.hunter;
			scorelines.push(`${hunter.rank !== null ? `${rankmojiArray[hunter.rank]} ` : ""}#${participation.placement} **${hunterMembers.get(participation.userId).displayName}** __Level ${hunter.level}__ *${participation.xp} season XP*`);
		}
	}
	const embed = new EmbedBuilder().setColor(Colors.Blurple)
		.setAuthor(module.exports.ihpAuthorPayload)
		.setThumbnail(company.scoreboardThumbnailURL ?? "https://cdn.discordapp.com/attachments/545684759276421120/734094693217992804/scoreboard.png")
		.setTitle("The Season Scoreboard")
		.setFooter(randomFooterTip())
		.setTimestamp();
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

	if (description) {
		embed.setDescription(description);
	} else {
		embed.setDescription("No Bounty Hunters yet…");
	}

	const fields = [];
	const { goalId, currentGP, requiredGP } = await logicLayer.goals.findLatestGoalProgress(guild.id);
	if (goalId !== null) {
		fields.push({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
	}
	if (company.festivalMultiplier !== 1) {
		fields.push({ name: "XP Festival", value: `An XP multiplier festival is currently active for ${company.festivalMultiplierString()}.` });
	}
	if (company.nextRaffleString) {
		fields.push({ name: "Next Raffle", value: `The next raffle will be on ${company.nextRaffleString}!` });
	}

	if (fields.length > 0) {
		embed.addFields(fields);
	}
	return embed;
}

/** An overall scoreboard orders a company's hunters by total xp
 * @param {Guild} guild
 * @param {typeof import("../logic")} logicLayer
 */
async function buildOverallScoreboardEmbed(guild, logicLayer) {
	const hunters = await logicLayer.hunters.findCompanyHuntersByDescendingXP(guild.id);
	const [company] = await logicLayer.companies.findOrCreateCompany(guild.id);

	const hunterMembers = await guild.members.fetch({ user: hunters.map(hunter => hunter.userId) });
	const rankmojiArray = (await logicLayer.ranks.findAllRanks(guild.id, "descending")).map(rank => rank.rankmoji);

	const scorelines = [];
	for (const hunter of hunters) {
		if (hunter.xp > 0) {
			scorelines.push(`${hunter.rank !== null ? `${rankmojiArray[hunter.rank]} ` : ""} **${hunterMembers.get(hunter.userId).displayName}** __Level ${hunter.level}__ *${hunter.xp} XP*`);
		}
	}
	const embed = new EmbedBuilder().setColor(Colors.Blurple)
		.setAuthor(module.exports.ihpAuthorPayload)
		.setThumbnail(company.scoreboardThumbnailURL ?? "https://cdn.discordapp.com/attachments/545684759276421120/734094693217992804/scoreboard.png")
		.setTitle("The Scoreboard")
		.setFooter(randomFooterTip())
		.setTimestamp();
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

	if (description) {
		embed.setDescription(description);
	} else {
		embed.setDescription("No Bounty Hunters yet…");
	}

	const fields = [];
	const { goalId, currentGP, requiredGP } = await logicLayer.goals.findLatestGoalProgress(guild.id);
	if (goalId !== null) {
		fields.push({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
	}
	if (company.festivalMultiplier !== 1) {
		fields.push({ name: "XP Festival", value: `An XP multiplier festival is currently active for ${company.festivalMultiplierString()}.` });
	}
	if (company.nextRaffleString) {
		fields.push({ name: "Next Raffle", value: `The next raffle will be on ${company.nextRaffleString}!` });
	}

	if (fields.length > 0) {
		embed.addFields(fields);
	}

	return embed;
}

/** The version embed lists the following: changes in the most recent update, known issues in the most recent update, and links to support the project
 * @returns {MessageEmbed}
 */
async function buildVersionEmbed() {
	const changelogPath = "./ChangeLog.md";
	const data = await fs.promises.readFile(changelogPath, { encoding: 'utf8' });
	const stats = await fs.promises.stat(changelogPath);
	const dividerRegEx = /## .+ Version/g;
	const changesStartRegEx = /\.\d+:/g;
	let titleStart = dividerRegEx.exec(data).index;
	changesStartRegEx.exec(data);
	let sectionEnd = dividerRegEx.exec(data).index;

	return new EmbedBuilder().setColor(Colors.Blurple)
		.setAuthor(module.exports.ihpAuthorPayload)
		.setTitle(data.slice(titleStart + 3, changesStartRegEx.lastIndex))
		.setURL('https://discord.gg/JxqE9EpKt9')
		.setThumbnail('https://cdn.discordapp.com/attachments/545684759276421120/734099622846398565/newspaper.png')
		.setDescription(data.slice(changesStartRegEx.lastIndex, sectionEnd).slice(0, MAX_EMBED_DESCRIPTION_LENGTH))
		.addFields({ name: "Become a Sponsor", value: "Chip in for server costs or get premium features by sponsoring [BountyBot on GitHub](https://github.com/Imaginary-Horizons-Productions/BountyBot)" })
		.setFooter(randomFooterTip())
		.setTimestamp(stats.mtime);
}

/** If the guild has a scoreboard reference channel, update the embed in it
 * @param {Guild} guild
 * @param {Sequelize} database
 */
async function updateScoreboard(guild, logicLayer) {
	const [company] = await logicLayer.companies.findOrCreateCompany(guild.id);
	if (company.scoreboardChannelId && company.scoreboardMessageId) {
		guild.channels.fetch(company.scoreboardChannelId).then(scoreboard => {
			return scoreboard.messages.fetch(company.scoreboardMessageId);
		}).then(async scoreboardMessage => {
			scoreboardMessage.edit({ embeds: [company.scoreboardIsSeasonal ? await buildSeasonalScoreboardEmbed(guild, logicLayer) : await buildOverallScoreboardEmbed(guild, logicLayer)] });
		});
	}
}

module.exports = {
	ihpAuthorPayload: { name: "Click here to check out the Imaginary Horizons GitHub", iconURL: "https://images-ext-2.discordapp.net/external/8DllSg9z_nF3zpNliVC3_Q8nQNu9J6Gs0xDHP_YthRE/https/cdn.discordapp.com/icons/353575133157392385/c78041f52e8d6af98fb16b8eb55b849a.png", url: "https://github.com/Imaginary-Horizons-Productions" },
	randomFooterTip,
	buildSeasonalScoreboardEmbed,
	buildOverallScoreboardEmbed,
	buildVersionEmbed,
	updateScoreboard
};
