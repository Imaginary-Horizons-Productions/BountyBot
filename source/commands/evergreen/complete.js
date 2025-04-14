const { MessageFlags } = require("discord.js");
const { Bounty } = require("../../models/bounties/Bounty");
const { getRankUpdates } = require("../../util/scoreUtil");
const { generateTextBar } = require("../../util/textUtil");
const { Goal } = require("../../models/companies/Goal");
const { SubcommandWrapper } = require("../../classes");

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
			if (runMode !== "production" || !(guildMember?.id !== interaction.user.id && !guildMember.user.bot)) {
				hunterMembers.push(guildMember);
			}
		}

		const validatedCompleterIds = hunterMembers.map(member => member.id);
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
		const completions = await logicLayer.bounties.bulkCreateCompletions(rawCompletions);

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
		description: "The slot number of the bounty",
		required: true
	},
	{
		type: "String",
		name: "bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: true
	},
	{
		type: "String",
		name: "second-bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: false
	},
	{
		type: "String",
		name: "third-bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: false
	},
	{
		type: "String",
		name: "fourth-bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: false
	},
	{
		type: "String",
		name: "fifth-bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: false
	}
);
