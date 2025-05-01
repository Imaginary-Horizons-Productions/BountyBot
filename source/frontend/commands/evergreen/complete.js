const { MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { Bounty } = require("../../../database/models");
const { getRankUpdates, generateTextBar, buildBountyEmbed, generateBountyRewardString, buildCompanyLevelUpLine, updateScoreboard, seasonalScoreboardEmbed, overallScoreboardEmbed, buildHunterLevelUpLine, generateCompletionEmbed } = require("../../shared");

module.exports = new SubcommandWrapper("complete", "Distribute rewards for turn-ins of an evergreen bounty",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		const slotNumber = interaction.options.getInteger("bounty-slot");
		const bounty = await logicLayer.bounties.findOneEvergreenBounty(interaction.guild.id, slotNumber);
		if (!bounty) {
			interaction.reply({ content: "There isn't an evergreen bounty in the `bounty-slot` provided.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		const company = await logicLayer.companies.findCompanyByPK(interaction.guild.id);
		const hunterMembers = [];
		for (const potentialHunter of ["bounty-hunter", "second-bounty-hunter", "third-bounty-hunter", "fourth-bounty-hunter", "fifth-bounty-hunter"]) {
			const guildMember = interaction.options.getMember(potentialHunter);
			if (guildMember) {
				if (runMode !== "production" || !guildMember.user.bot) {
					hunterMembers.push(guildMember);
				}
			}
		}

		const validatedCompleterIds = hunterMembers.map(member => member.id);
		if (validatedCompleterIds.length < 1) {
			interaction.reply({ content: "No valid bounty hunters received. Bots cannot be credited for bounty completion.", flags: [MessageFlags.Ephemeral] })
			return;
		}

		const season = await logicLayer.seasons.incrementSeasonStat(interaction.guild.id, "bountiesCompleted");

		// Evergreen bounties are not eligible for showcase bonuses
		const allHunters = await logicLayer.hunters.findCompanyHunters(interaction.guild.id);
		const previousCompanyLevel = company.getLevel(allHunters);
		const bountyBaseValue = Bounty.calculateCompleterReward(company.getLevel(allHunters), slotNumber, 0);
		const bountyValue = bountyBaseValue * company.festivalMultiplier;
		const rawCompletions = validatedCompleterIds.map(userId => ({
			bountyId: bounty.id,
			userId,
			companyId: interaction.guildId,
			xpAwarded: bountyValue
		}));
		const completions = await logicLayer.bounties.bulkCreateCompletions(rawCompletions);

		const levelTexts = [];
		let totalGP = 0;
		let wasGoalCompleted = false;
		const finalContributorIds = new Set(validatedCompleterIds);
		for (const userId of validatedCompleterIds) {
			const hunter = await logicLayer.hunters.findOneHunter(userId, interaction.guild.id);
			const previousHunterLevel = hunter.getLevel(company.xpCoefficient);
			await hunter.increment({ othersFinished: 1, xp: bountyValue }).then(hunter => hunter.reload());
			const levelLine = buildHunterLevelUpLine(hunter, previousHunterLevel, company.xpCoefficient, company.maxSimBounties);
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
			} else {
				return hunter;
			}
		}))
		const companyLevelLine = buildCompanyLevelUpLine(company, previousCompanyLevel, reloadedHunters, interaction.guild.name);
		if (companyLevelLine) {
			levelTexts.push(companyLevelLine);
		}
		buildBountyEmbed(bounty, interaction.guild, company.getLevel(allHunters), true, company.getThumbnailURLMap(), company.festivalMultiplierString(), completions).then(async embed => {
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
				acknowledgeOptions.embeds.push(generateCompletionEmbed([...finalContributorIds.keys()]));
			}
			return interaction.reply(acknowledgeOptions);
		}).then(response => {
			getRankUpdates(interaction.guild, logicLayer).then(async rankUpdates => {
				response.resource.message.startThread({ name: `${bounty.title} Rewards` }).then(thread => {
					thread.send({ content: generateBountyRewardString(validatedCompleterIds, bountyBaseValue, null, null, company.festivalMultiplierString(), rankUpdates, levelTexts), flags: MessageFlags.SuppressNotifications });
				})
				const embeds = [];
				const ranks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
				const goalProgress = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
				if (company.scoreboardIsSeasonal) {
					embeds.push(await seasonalScoreboardEmbed(company, interaction.guild, await logicLayer.seasons.findSeasonParticipations(season.id), ranks, goalProgress));
				} else {
					embeds.push(await overallScoreboardEmbed(company, interaction.guild, await logicLayer.hunters.findCompanyHunters(interaction.guild.id), ranks, goalProgress));
				}
				updateScoreboard(company, interaction.guild, embeds);
			});
		})
	}
).setOptions(
	{
		type: "Integer",
		name: "bounty-slot",
		description: "The slot number of the bounty",
		required: true
	},
	{
		type: "User",
		name: "bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: true
	},
	{
		type: "User",
		name: "second-bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: false
	},
	{
		type: "User",
		name: "third-bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: false
	},
	{
		type: "User",
		name: "fourth-bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: false
	},
	{
		type: "User",
		name: "fifth-bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: false
	}
);
