const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");
const { Bounty } = require("../../models/bounties/Bounty");
const { getRankUpdates } = require("../../util/scoreUtil");
const { updateScoreboard } = require("../../util/embedUtil");
const { extractUserIdsFromMentions, commandMention } = require("../../util/textUtil");
const { MAX_MESSAGE_CONTENT_LENGTH } = require("../../constants");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {...unknown} args
 */
async function executeSubcommand(interaction, database, runMode, ...args) {
	const slotNumber = interaction.options.getInteger("bounty-slot");
	const bounty = await database.models.Bounty.findOne({ where: { isEvergreen: true, companyId: interaction.guildId, slotNumber, state: "open" } });
	if (!bounty) {
		interaction.reply({ content: "There isn't an evergreen bounty in the `bounty-slot` provided.", ephemeral: true });
		return;
	}

	const company = await database.models.Company.findByPk(interaction.guildId);
	const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });

	const mentionedIds = extractUserIdsFromMentions(interaction.options.getString("hunters"), []);

	if (mentionedIds.length < 1) {
		interaction.reply({ content: "Could not find any bounty hunter ids in `hunters`.", ephemeral: true })
		return;
	}

	const dedupedCompleterIds = [];
	for (const id of mentionedIds) {
		if (!dedupedCompleterIds.includes(id)) {
			dedupedCompleterIds.push(id);
		}
	}

	const validatedCompleterIds = [];
	const completerMembers = dedupedCompleterIds.length > 0 ? (await interaction.guild.members.fetch({ user: dedupedCompleterIds })).values() : [];
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
		interaction.reply({ content: "There aren't any eligible bounty hunters to credit with completing this evergreen bounty.", ephemeral: true })
		return;
	}

	season.increment("bountiesCompleted");

	const rawCompletions = [];
	for (const userId of dedupedCompleterIds) {
		rawCompletions.push({
			bountyId: bounty.id,
			userId,
			companyId: interaction.guildId
		});
	}
	await database.models.Completion.bulkCreate(rawCompletions);

	// Evergreen bounties are not eligible for showcase bonuses
	const bountyBaseValue = Bounty.calculateCompleterReward(company.level, slotNumber, 0);
	const bountyValue = bountyBaseValue * company.festivalMultiplier;
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

	bounty.asEmbed(interaction.guild, company.level, company.festivalMultiplierString(), true, database).then(embed => {
		return interaction.reply({ embeds: [embed], fetchReply: true });
	}).then(replyMessage => {
		getRankUpdates(interaction.guild, database).then(rankUpdates => {
			replyMessage.startThread({ name: `${bounty.title} Rewards` }).then(thread => {
				const multiplierString = company.festivalMultiplierString();
				let text = `__**XP Gained**__\n${validatedCompleterIds.map(id => `<@${id}> + ${bountyBaseValue} XP${multiplierString}`).join("\n")}`;
				if (rankUpdates.length > 0) {
					text += `\n\n__**Rank Ups**__\n- ${rankUpdates.join("\n- ")}`;
				}
				if (levelTexts.length > 0) {
					text += `\n\n__**Rewards**__\n- ${levelTexts.join("\n- ")}`;
				}
				if (text.length > MAX_MESSAGE_CONTENT_LENGTH) {
					text = `Message overflow! Many people (?) probably gained many things (?). Use ${commandMention("stats")} to look things up.`;
				}
				thread.send({ content: text, flags: MessageFlags.SuppressNotifications });
			})
			updateScoreboard(company, interaction.guild, database);
		});
	})
};

module.exports = {
	data: {
		name: "complete",
		description: "Awarding XP to a hunter for completing an evergreen bounty",
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
				required: true
			}
		]
	},
	executeSubcommand
};
