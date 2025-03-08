const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");
const { Bounty } = require("../../models/bounties/Bounty");
const { getRankUpdates } = require("../../util/scoreUtil");
const { updateScoreboard } = require("../../util/embedUtil");
const { extractUserIdsFromMentions, generateTextBar } = require("../../util/textUtil");
const { Goal } = require("../../models/companies/Goal");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer]) {
	const slotNumber = interaction.options.getInteger("bounty-slot");
	const bounty = await database.models.Bounty.findOne({ where: { isEvergreen: true, companyId: interaction.guildId, slotNumber, state: "open" } });
	if (!bounty) {
		interaction.reply({ content: "There isn't an evergreen bounty in the `bounty-slot` provided.", flags: [MessageFlags.Ephemeral] });
		return;
	}

	const company = await logicLayer.companies.findCompanyByPK(interaction.guild.id);

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
			const [hunter] = await logicLayer.hunters.findOrCreateBountyHunter(memberId, interaction.guild.id);
			if (!hunter.isBanned) {
				validatedCompleterIds.push(memberId);
			}
		}
	}

	if (validatedCompleterIds.length < 1) {
		interaction.reply({ content: "There aren't any eligible bounty hunters to credit with completing this evergreen bounty.", flags: [MessageFlags.Ephemeral] })
		return;
	}

	const season = await logicLayer.seasons.incrementSeasonStat(interaction.guild.id, "bountiesCompleted");

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
		const hunter = await logicLayer.hunters.findOneHunter(userId, interaction.guild.id);
		levelTexts.push(...await hunter.addXP(interaction.guild.name, bountyValue, true, company));
		hunter.increment("othersFinished");
		logicLayer.seasons.changeSeasonXP(userId, interaction.guildId, season.id, bountyValue);
		const { gpContributed, goalCompleted, contributorIds } = await logicLayer.goals.progressGoal(interaction.guildId, "bounties", hunter, season);
		totalGP += gpContributed;
		wasGoalCompleted ||= goalCompleted;
		contributorIds.forEach(id => finalContributorIds.add(id));
	}

	bounty.embed(interaction.guild, company.level, true, company, completions).then(async embed => {
		const acknowledgeOptions = { embeds: [embed], withResponse: true };
		if (totalGP > 0) {
			levelTexts.push(`This bounty contributed ${totalGP} GP to the Server Goal!`);
			const { goalId, currentGP, requiredGP } = await logicLayer.goals.findLatestGoalProgress(interaction.guildId);
			if (goalId !== null) {
				embed.addFields({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${Math.min(currentGP, requiredGP)}/${requiredGP} GP` });
			} else {
				embed.addFields({ name: "Server Goal", value: `${generateTextBar(15, 15, 15)} Completed!` });
			}
		}
		if (wasGoalCompleted) {
			acknowledgeOptions.embeds.push(Goal.generateCompletionEmbed([...finalContributorIds.keys()]));
		}
		return interaction.reply(acknowledgeOptions);
	}).then(response => {
		getRankUpdates(interaction.guild, logicLayer).then(rankUpdates => {
			response.resource.message.startThread({ name: `${bounty.title} Rewards` }).then(thread => {
				thread.send({ content: Bounty.generateRewardString(validatedCompleterIds, bountyBaseValue, null, null, company.festivalMultiplierString(), rankUpdates, levelTexts), flags: MessageFlags.SuppressNotifications });
			})
			updateScoreboard(interaction.guild, database, logicLayer);
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
