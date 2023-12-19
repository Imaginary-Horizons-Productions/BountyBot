const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");
const { Bounty } = require("../../models/bounties/Bounty");
const { updateScoreboard } = require("../../util/embedUtil");
const { extractUserIdsFromMentions } = require("../../util/textUtil");
const { getRankUpdates } = require("../../util/scoreUtil");
const { MAX_MESSAGE_CONTENT_LENGTH } = require("../../constants");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[string]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[posterId]) {
	const slotNumber = interaction.options.getInteger("bounty-slot");
	const bounty = await database.models.Bounty.findOne({ where: { userId: posterId, companyId: interaction.guildId, slotNumber, state: "open" }, include: database.models.Bounty.Company });
	if (!bounty) {
		interaction.reply({ content: "You don't have a bounty in the `bounty-slot` provided.", ephemeral: true });
		return;
	}

	// disallow completion within 5 minutes of creating bounty
	if (runMode === "prod" && new Date() < new Date(new Date(bounty.createdAt) + timeConversion(5, "m", "ms"))) {
		interaction.reply({ content: "Bounties cannot be completed within 5 minutes of their posting. You can `/bounty add-completers` so you won't forget instead.", ephemeral: true });
		return;
	}

	// poster guaranteed to exist, creating a bounty gives 1 XP
	const poster = await database.models.Hunter.findOne({ where: { userId: posterId, companyId: interaction.guildId } });
	const season = await database.models.Season.findOne({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
	const bountyValue = Bounty.calculateReward(poster.level, slotNumber, bounty.showcaseCount) * bounty.Company.eventMultiplier;

	const allCompleterIds = (await database.models.Completion.findAll({ where: { bountyId: bounty.id } })).map(reciept => reciept.userId);
	const mentionedIds = extractUserIdsFromMentions(interaction.options.getString("hunters"), []);
	const completerIdsWithoutReciept = [];
	for (const id of mentionedIds) {
		if (!allCompleterIds.includes(id)) {
			allCompleterIds.push(id);
			completerIdsWithoutReciept.push(id);
		}
	}

	const validatedCompleterIds = [];
	const completerMembers = allCompleterIds.length > 0 ? (await interaction.guild.members.fetch({ user: allCompleterIds })).values() : [];
	let levelTexts = [];
	for (const member of completerMembers) {
		if (runMode !== "prod" || !member.user.bot) {
			const memberId = member.id;
			await database.models.User.findOrCreate({ where: { id: memberId } });
			const [hunter] = await database.models.Hunter.findOrCreate({ where: { userId: memberId, companyId: interaction.guildId } });
			if (!hunter.isBanned) {
				validatedCompleterIds.push(memberId);
			}
		}
	}

	if (validatedCompleterIds.length < 1) {
		interaction.reply({ content: "There aren't any eligible bounty hunters to credit with completing this bounty. If you'd like to close your bounty without crediting anyone, use `/bounty take-down`.", ephemeral: true })
		return;
	}

	season.increment("bountiesCompleted");

	bounty.state = "completed";
	bounty.completedAt = new Date();
	bounty.save();

	const rawCompletions = [];
	for (const userId of completerIdsWithoutReciept) {
		rawCompletions.push({
			bountyId: bounty.id,
			userId,
			companyId: interaction.guildId
		});
	}
	await database.models.Completion.bulkCreate(rawCompletions);
	database.models.Completion.update({ xpAwarded: bountyValue }, { where: { bountyId: bounty.id } });

	for (const userId of validatedCompleterIds) {
		const hunter = await database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId } });
		const completerLevelTexts = await hunter.addXP(interaction.guild.name, bountyValue, true, database);
		if (completerLevelTexts.length > 0) {
			levelTexts = levelTexts.concat(completerLevelTexts);
		}
		hunter.othersFinished++;
		hunter.save();
	}

	const posterXP = Math.ceil(validatedCompleterIds.length / 2) * bounty.Company.eventMultiplier;
	const posterLevelTexts = await poster.addXP(interaction.guild.name, posterXP, true, database);
	if (posterLevelTexts.length > 0) {
		levelTexts = levelTexts.concat(posterLevelTexts);
	}
	poster.mineFinished++;
	poster.save();

	getRankUpdates(interaction.guild, database).then(rankUpdates => {
		const multiplierString = bounty.Company.festivalMultiplierString();
		let text = `__**XP Gained**__\n${validatedCompleterIds.map(id => `<@${id}> + ${bountyValue} XP${multiplierString}`).join("\n")}\n${interaction.member} + ${posterXP} XP${multiplierString}`;
		if (rankUpdates.length > 0) {
			text += `\n\n__**Rank Ups**__\n- ${rankUpdates.join("\n- ")}`;
		}
		if (levelTexts.length > 0) {
			text += `\n\n__**Rewards**__\n- ${levelTexts.join("\n- ")}`;
		}
		if (text.length > MAX_MESSAGE_CONTENT_LENGTH) {
			text = "Message overflow! Many people (?) probably gained many things (?). Use `/stats` to look things up.";
		}

		bounty.asEmbed(interaction.guild, poster.level, bounty.Company.festivalMultiplierString(), true, database).then(embed => {
			const replyPayload = { embeds: [embed] };

			if (bounty.Company.bountyBoardId) {
				interaction.guild.channels.fetch(bounty.Company.bountyBoardId).then(bountyBoard => {
					bountyBoard.threads.fetch(bounty.postingId).then(thread => {
						thread.send({ content: text, flags: MessageFlags.SuppressNotifications });
					})
				})
			} else {
				replyPayload.content = text;
			}
			interaction.reply(replyPayload);
		}).then(() => {
			return bounty.updatePosting(interaction.guild, bounty.Company, database);
		})

		updateScoreboard(bounty.Company, interaction.guild, database);
	});
};

module.exports = {
	data: {
		name: "complete",
		description: "Close one of your open bounties, awarding XP to completers",
		optionsInput: [
			{
				type: "Integer",
				name: "bounty-slot",
				description: "The slot number of the bounty to complete",
				required: true
			},
			{
				type: "String",
				name: "hunters",
				description: "The bounty hunter(s) to credit with completion",
				required: false
			}
		]
	},
	executeSubcommand
};