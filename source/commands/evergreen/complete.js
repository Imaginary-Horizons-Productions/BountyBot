const { CommandInteraction, MessageFlags, EmbedBuilder, userMention } = require("discord.js");
const { Sequelize } = require("sequelize");
const { Bounty } = require("../../models/bounties/Bounty");
const { getRankUpdates } = require("../../util/scoreUtil");
const { updateScoreboard } = require("../../util/embedUtil");
const { extractUserIdsFromMentions, commandMention, congratulationBuilder, listifyEN, generateTextBar } = require("../../util/textUtil");
const { MAX_MESSAGE_CONTENT_LENGTH } = require("../../constants");
const { progressGoal, findLatestGoalProgress } = require("../../logic/goals");

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
		interaction.reply({ content: "There isn't an evergreen bounty in the `bounty-slot` provided.", flags: [MessageFlags.Ephemeral] });
		return;
	}

	const company = await database.models.Company.findByPk(interaction.guildId);
	const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });

	const mentionedIds = extractUserIdsFromMentions(interaction.options.getString("hunters"), []);
	if (mentionedIds.length < 1) {
		interaction.reply({ content: "Could not find any bounty hunter ids in `hunters`.", flags: [MessageFlags.Ephemeral] })
		return;
	}

	const dedupedCompleterIds = [];
	for (const id of mentionedIds) {
		if (!dedupedCompleterIds.includes(id)) {
			dedupedCompleterIds.push(id);
		}
	}

	const validatedCompleterIds = [];
	for (const member of (await interaction.guild.members.fetch({ user: dedupedCompleterIds })).values()) {
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
		interaction.reply({ content: "There aren't any eligible bounty hunters to credit with completing this evergreen bounty.", flags: [MessageFlags.Ephemeral] })
		return;
	}

	season.increment("bountiesCompleted");

	const rawCompletions = [];
	// Evergreen bounties are not eligible for showcase bonuses
	const bountyBaseValue = Bounty.calculateCompleterReward(company.level, slotNumber, 0);
	const bountyValue = bountyBaseValue * company.festivalMultiplier;
	for (const userId of dedupedCompleterIds) {
		rawCompletions.push({
			bountyId: bounty.id,
			userId,
			companyId: interaction.guildId,
			xpAwarded: bountyValue
		});
	}
	const completions = await database.models.Completion.bulkCreate(rawCompletions);

	const levelTexts = [];
	let totalGP = 0;
	let wasGoalCompleted = false;
	const finalContributorIds = new Set(validatedCompleterIds);
	for (const userId of validatedCompleterIds) {
		const hunter = await database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId } });
		levelTexts.push(...await hunter.addXP(interaction.guild.name, bountyValue, true, database));
		hunter.increment("othersFinished");
		const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { companyId: interaction.guildId, userId, seasonId: season.id }, defaults: { xp: bountyValue } });
		if (!participationCreated) {
			participation.increment({ xp: bountyValue });
		}
		const { gpContributed, goalCompleted, contributorIds } = await progressGoal(interaction.guildId, "bounties", userId);
		totalGP += gpContributed;
		wasGoalCompleted ||= goalCompleted;
		contributorIds.forEach(id => finalContributorIds.add(id));
	}

	bounty.embed(interaction.guild, company.level, true, company, completions).then(async embed => {
		const acknowledgeOptions = { embeds: [embed], withResponse: true };
		if (totalGP > 0) {
			levelTexts.push(`This bounty contributed ${totalGP} GP to the Server Goal!`);
			const { goalId, currentGP, requiredGP } = await findLatestGoalProgress(interaction.guildId);
			if (goalId !== null) {
				embed.addFields({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${Math.min(currentGP, requiredGP)}/${requiredGP} GP` });
			} else {
				embed.addFields({ name: "Server Goal", value: `${generateTextBar(15, 15, 15)} Completed!` });
			}
		}
		if (wasGoalCompleted) {
			acknowledgeOptions.embeds.push(
				new EmbedBuilder().setColor("e5b271")
					.setTitle("Server Goal Completed")
					.setThumbnail("https://cdn.discordapp.com/attachments/673600843630510123/1309260766318166117/trophy-cup.png?ex=6740ef9b&is=673f9e1b&hm=218e19ede07dcf85a75ecfb3dde26f28adfe96eb7b91e89de11b650f5c598966&")
					.setDescription(`${congratulationBuilder()}, the Server Goal was completed! Contributors have double chance to find items on their next bounty completion.`)
					.addFields({ name: "Contributors", value: listifyEN([...finalContributorIds.keys()].map(id => userMention(id))) })
			);
		}
		return interaction.reply(acknowledgeOptions);
	}).then(response => {
		getRankUpdates(interaction.guild, database).then(rankUpdates => {
			response.resource.message.startThread({ name: `${bounty.title} Rewards` }).then(thread => {
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
