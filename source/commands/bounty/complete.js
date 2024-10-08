const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");
const { Bounty } = require("../../models/bounties/Bounty");
const { updateScoreboard } = require("../../util/embedUtil");
const { extractUserIdsFromMentions, timeConversion, commandMention } = require("../../util/textUtil");
const { getRankUpdates } = require("../../util/scoreUtil");
const { MAX_MESSAGE_CONTENT_LENGTH } = require("../../constants");
const { rollItemDrop } = require("../../util/itemUtil");

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
		interaction.reply({ content: `Bounties cannot be completed within 5 minutes of their posting. You can ${commandMention("bounty add-completers")} so you won't forget instead.`, ephemeral: true });
		return;
	}

	const allCompleterIds = (await database.models.Completion.findAll({ where: { bountyId: bounty.id } })).map(reciept => reciept.userId);
	const mentionedIds = extractUserIdsFromMentions(interaction.options.getString("hunters"), []);
	const completerIdsWithoutReciept = [];
	for (const id of mentionedIds) {
		if (!allCompleterIds.includes(id)) {
			allCompleterIds.push(id);
			completerIdsWithoutReciept.push(id);
		}
	}

	const completerMembers = allCompleterIds.length > 0 ? (await interaction.guild.members.fetch({ user: allCompleterIds })).values() : [];
	const validatedCompleterIds = [];
	const validatedHunters = [];
	for (const member of completerMembers) {
		if (runMode !== "prod" || !member.user.bot) {
			const memberId = member.id;
			await database.models.User.findOrCreate({ where: { id: memberId } });
			const [hunter] = await database.models.Hunter.findOrCreate({ where: { userId: memberId, companyId: interaction.guildId } });
			if (!hunter.isBanned) {
				validatedCompleterIds.push(memberId);
				validatedHunters.push(hunter);
			}
		}
	}

	if (validatedCompleterIds.length < 1) {
		interaction.reply({ content: `There aren't any eligible bounty hunters to credit with completing this bounty. If you'd like to close your bounty without crediting anyone, use ${commandMention("bounty take-down")}.`, ephemeral: true })
		return;
	}

	await interaction.deferReply();
	const season = await database.models.Season.findOne({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
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

	// poster guaranteed to exist, creating a bounty gives 1 XP
	const poster = await database.models.Hunter.findOne({ where: { userId: posterId, companyId: interaction.guildId } });
	const bountyBaseValue = Bounty.calculateCompleterReward(poster.level, slotNumber, bounty.showcaseCount);
	const bountyValue = bountyBaseValue * bounty.Company.festivalMultiplier;
	database.models.Completion.update({ xpAwarded: bountyValue }, { where: { bountyId: bounty.id } });
	let levelTexts = [];

	for (const hunter of validatedHunters) {
		const completerLevelTexts = await hunter.addXP(interaction.guild.name, bountyValue, true, database);
		if (completerLevelTexts.length > 0) {
			levelTexts = levelTexts.concat(completerLevelTexts);
		}
		hunter.increment("othersFinished");
		const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { companyId: interaction.guildId, userId: hunter.userId, seasonId: season.id }, defaults: { xp: bountyValue } });
		if (!participationCreated) {
			participation.increment({ xp: bountyValue });
		}
		const droppedItem = rollItemDrop(1 / 8);
		if (droppedItem) {
			const [itemRow, itemWasCreated] = await database.models.Item.findOrCreate({ where: { userId: hunter.userId, itemName: droppedItem } });
			if (!itemWasCreated) {
				itemRow.increment("count");
			}
			levelTexts.push(`<@${hunter.userId}> has found a **${droppedItem}**!`);
		}
	}

	const posterXP = bounty.calculatePosterReward(validatedCompleterIds.length);
	const posterLevelTexts = await poster.addXP(interaction.guild.name, posterXP * bounty.Company.festivalMultiplier, true, database);
	if (posterLevelTexts.length > 0) {
		levelTexts = levelTexts.concat(posterLevelTexts);
	}
	poster.increment("mineFinished");
	const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { companyId: interaction.guildId, userId: posterId, seasonId: season.id }, defaults: { xp: posterXP, postingsCompleted: 1 } });
	if (!participationCreated) {
		participation.increment({ xp: posterXP, postingsCompleted: 1 });
	}
	const droppedItem = rollItemDrop(1 / 4);
	if (droppedItem) {
		const [itemRow, itemWasCreated] = await database.models.Item.findOrCreate({ where: { userId: posterId, itemName: droppedItem } });
		if (!itemWasCreated) {
			itemRow.increment("count");
		}
		levelTexts.push(`<@${poster.userId}> has found a **${droppedItem}**!`);
	}

	getRankUpdates(interaction.guild, database).then(rankUpdates => {
		const multiplierString = bounty.Company.festivalMultiplierString();
		let text = `__**XP Gained**__\n${validatedCompleterIds.map(id => `<@${id}> + ${bountyBaseValue} XP${multiplierString}`).join("\n")}\n${interaction.member} + ${posterXP} XP${multiplierString}`;
		if (rankUpdates.length > 0) {
			text += `\n\n__**Rank Ups**__\n- ${rankUpdates.join("\n- ")}`;
		}
		if (levelTexts.length > 0) {
			text += `\n\n__**Rewards**__\n- ${levelTexts.join("\n- ")}`;
		}
		if (text.length > MAX_MESSAGE_CONTENT_LENGTH) {
			text = `Message overflow! Many people (?) probably gained many things (?). Use ${commandMention("stats")} to look things up.`;
		}

		bounty.asEmbed(interaction.guild, poster.level, bounty.Company.festivalMultiplierString(), true, database).then(async embed => {
			if (bounty.Company.bountyBoardId) {
				const bountyBoard = await interaction.guild.channels.fetch(bounty.Company.bountyBoardId);
				bountyBoard.threads.fetch(bounty.postingId).then(async thread => {
					if (thread.archived) {
						await thread.setArchived(false, "bounty completed");
					}
					thread.setAppliedTags([bounty.Company.bountyBoardCompletedTagId]);
					thread.send({ content: text, flags: MessageFlags.SuppressNotifications });
					return thread.fetchStarterMessage();
				}).then(posting => {
					posting.edit({ embeds: [embed], components: [] }).then(() => {
						posting.channel.setArchived(true, "bounty completed");
					});
				});
				interaction.editReply({ content: `<@${bounty.userId}>'s bounty, <#${bounty.postingId}>, was completed!` });
			} else {
				interaction.editReply({ content: `<@${bounty.userId}>'s bounty, **${bounty.title}**, was completed!` }).then(message => {
					message.startThread({ name: `${bounty.title} Rewards` }).then(thread => {
						thread.send({ content: text, flags: MessageFlags.SuppressNotifications });
					})
				}).catch(error => {
					// Ignore Missing Access errors, they only prevent the making of the thread
					if (error.code !== 50001) {
						console.error(error);
					}
				});
			}
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
