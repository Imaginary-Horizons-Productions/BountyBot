const { PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { extractUserIdsFromMentions, textsHaveAutoModInfraction, generateTextBar } = require('../util/textUtil');
const { getRankUpdates } = require('../util/scoreUtil.js');
const { Toast } = require('../models/toasts/Toast.js');
const { Goal } = require('../models/companies/Goal.js');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "toast";
module.exports = new CommandWrapper(mainId, "Raise a toast to other bounty hunter(s), usually granting +1 XP", PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 30000,
	/** Provide 1 XP to mentioned hunters up to author's quota (10/48 hours), roll for crit toast (grants author XP) */
	async (interaction, runMode) => {
		const [company] = await logicLayer.companies.findOrCreateCompany(interaction.guildId);
		const [sender] = await logicLayer.hunters.findOrCreateBountyHunter(interaction.user.id, interaction.guildId);
		if (sender.isBanned) {
			interaction.reply({ content: `You are banned from interacting with BountyBot on ${interaction.guild.name}.`, flags: [MessageFlags.Ephemeral] });
			return;
		}

		const errors = [];

		// Find valid toastees
		const toasteeIds = extractUserIdsFromMentions(interaction.options.getString("toastees"), [interaction.user.id]);

		const nonBotToasteeIds = [];
		if (toasteeIds.length < 1) {
			errors.push("Could not parse any user mentions from `toastees`.");
		} else {
			const toasteeMembers = (await interaction.guild.members.fetch({ user: toasteeIds })).values();
			for (const member of toasteeMembers) {
				if (runMode !== "production" || !member.user.bot) {
					nonBotToasteeIds.push(member.id);
				}
			}

			if (nonBotToasteeIds.length < 1) {
				errors.push("Could not parse any non-bot mentions from `toastees`.");
			}
		}

		// Validate image-url is a URL
		const imageURL = interaction.options.getString("image-url");
		try {
			if (imageURL) {
				new URL(imageURL);
			}
		} catch (error) {
			errors.push(error.message);
		}

		// Early-out if any errors
		if (errors.length > 0) {
			interaction.reply({ content: `The following errors were encountered while raising your toast:\n- ${errors.join("\n- ")}`, flags: [MessageFlags.Ephemeral] });
			return;
		}

		const toastText = interaction.options.getString("message");
		if (await textsHaveAutoModInfraction(interaction.channel, interaction.member, [toastText], "toast")) {
			interaction.reply({ content: "Your toast was blocked by AutoMod.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		const season = await logicLayer.seasons.incrementSeasonStat(interaction.guild.id, "toastsRaised");

		const { toastId, rewardedHunterIds, rewardTexts, critValue } = await logicLayer.toasts.raiseToast(interaction.guild, company, interaction.member, sender, nonBotToasteeIds, season.id, toastText, imageURL);
		const embeds = [Toast.generateEmbed(company.toastThumbnailURL, toastText, nonBotToasteeIds, interaction.member)];
		if (imageURL) {
			embeds[0].setImage(imageURL);
		}

		if (rewardedHunterIds.length > 0) {
			const goalUpdate = await logicLayer.goals.progressGoal(interaction.guild.id, "toasts", sender, season);
			if (goalUpdate.gpContributed > 0) {
				rewardTexts.push(`This toast contributed ${goalUpdate.gpContributed} GP to the Server Goal!`);
				if (goalUpdate.goalCompleted) {
					embeds.push(Goal.generateCompletionEmbed(goalUpdate.contributorIds));
				}
				const { goalId, currentGP, requiredGP } = await logicLayer.goals.findLatestGoalProgress(interaction.guild.id);
				if (goalId !== null) {
					embeds[0].addFields({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${currentGP}/${requiredGP} GP` });
				} else {
					embeds[0].addFields({ name: "Server Goal", value: `${generateTextBar(15, 15, 15)} Completed!` });
				}
			}
		}

		interaction.reply({
			embeds,
			components: [Toast.generateSecondingActionRow(toastId)],
			withResponse: true
		}).then(async response => {
			let content = "";
			if (rewardedHunterIds.length > 0) {
				const rankUpdates = await getRankUpdates(interaction.guild, logicLayer);
				content = Toast.generateRewardString(rewardedHunterIds, rankUpdates, rewardTexts, interaction.member.toString(), company.festivalMultiplierString(), critValue);
			}

			if (content) {
				if (interaction.channel.isThread()) {
					interaction.channel.send({ content, flags: MessageFlags.SuppressNotifications });
				} else {
					response.resource.message.startThread({ name: "Rewards" }).then(thread => {
						thread.send({ content, flags: MessageFlags.SuppressNotifications });
					})
				}
				company.updateScoreboard(interaction.guild, logicLayer);
			}
		});
	}
).setOptions(
	{
		type: "String",
		name: "toastees",
		description: "The mention(s) of the bounty hunter(s) to whom you are raising a toast",
		required: true
	},
	{
		type: "String",
		name: "message",
		description: "The text of the toast to raise",
		required: true
	},
	{
		type: "String",
		name: "image-url",
		description: "The URL to the image to add to the toast",
		required: false
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
