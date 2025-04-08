const { MessageFlags } = require("discord.js");
const { Bounty } = require("../../models/bounties/Bounty");
const { getRankUpdates } = require("../../util/scoreUtil");
const { extractUserIdsFromMentions, generateTextBar } = require("../../util/textUtil");
const { Goal } = require("../../models/companies/Goal");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("complete", "Awarding XP to a hunter for completing an evergreen bounty",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		const slotNumber = interaction.options.getInteger("bounty-slot");
		const bounty = await logicLayer.bounties.findOneEvergreenBounty(interaction.guild.id, slotNumber);
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
			if (runMode !== "production" || !member.user.bot) {
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
		const allHunters = await logicLayer.hunters.findCompanyHunters(interaction.guild.id);
		const previousCompanyLevel = company.getLevel(allHunters);
		const bountyBaseValue = Bounty.calculateCompleterReward(company.getLevel(allHunters), slotNumber, 0);
		const bountyValue = bountyBaseValue * company.festivalMultiplier;
		for (const userId of dedupedCompleterIds) {
			rawCompletions.push({
				bountyId: bounty.id,
				userId,
				companyId: interaction.guildId,
				xpAwarded: bountyValue
			});
		}
		const completions = await logicLayer.bounties.bulkCreateCompletions(rawCompletions);

		const levelTexts = [];
		let totalGP = 0;
		let wasGoalCompleted = false;
		const finalContributorIds = new Set(validatedCompleterIds);
		for (const userId of validatedCompleterIds) {
			const hunter = await logicLayer.hunters.findOneHunter(userId, interaction.guild.id);
			const previousHunterLevel = hunter.getLevel(company.xpCoefficient);
			await hunter.increment({ othersFinished: 1, xp: bountyValue }).then(hunter => hunter.reload());
			const levelLine = hunter.buildLevelUpLine(previousHunterLevel, company.xpCoefficient, company.maxSimBounties);
			if (levelLine) {
				levelTexts.push(levelLine);
			}
			logicLayer.seasons.changeSeasonXP(userId, interaction.guildId, season.id, bountyValue);
			const { gpContributed, goalCompleted, contributorIds } = await logicLayer.goals.progressGoal(interaction.guildId, "bounties", hunter, season);
			totalGP += gpContributed;
			wasGoalCompleted ||= goalCompleted;
			contributorIds.forEach(id => finalContributorIds.add(id));
		}

		const reloadedHunters = await Promise.all(allHunters.map(hunter => {
			if (validatedCompleterIds.includes(hunter.userId)) {
				return hunter.reload();
			}
		}))
		const companyLevelLine = company.buildLevelUpLine(previousCompanyLevel, reloadedHunters, interaction.guild.name);
		if (companyLevelLine) {
			levelTexts.push(companyLevelLine);
		}
		bounty.embed(interaction.guild, company.getLevel(allHunters), true, company.getThumbnailURLMap(), company.festivalMultiplierString(), completions).then(async embed => {
			const acknowledgeOptions = { embeds: [embed], withResponse: true };
			if (totalGP > 0) {
				levelTexts.push(`This bounty contributed ${totalGP} GP to the Server Goal!`);
				const { goalId, currentGP, requiredGP } = await logicLayer.goals.findLatestGoalProgress(interaction.guildId);
				if (goalId !== null) {
					embed.addFields({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
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
				company.updateScoreboard(interaction.guild, logicLayer);
			});
		})
	}
).setOptions(
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
);
