const { PermissionFlagsBits, InteractionContextType, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, userMention } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { extractUserIdsFromMentions, textsHaveAutoModInfraction, listifyEN, congratulationBuilder, generateTextBar } = require('../util/textUtil');
const { raiseToast } = require('../logic/toasts.js');
const { updateScoreboard } = require('../util/embedUtil.js');
const { SAFE_DELIMITER } = require('../constants.js');
const { findOrCreateCompany } = require('../logic/companies.js');
const { findOrCreateBountyHunter } = require('../logic/hunters.js');
const { getRankUpdates } = require('../util/scoreUtil.js');
const { Toast } = require('../models/toasts/Toast.js');
const { progressGoal, findLatestGoalProgress } = require('../logic/goals.js');

const mainId = "toast";
module.exports = new CommandWrapper(mainId, "Raise a toast to other bounty hunter(s), usually granting +1 XP", PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 30000,
	/** Provide 1 XP to mentioned hunters up to author's quota (10/48 hours), roll for crit toast (grants author XP) */
	async (interaction, database, runMode) => {
		const [company] = await findOrCreateCompany(interaction.guildId);
		const [sender] = await findOrCreateBountyHunter(interaction.user.id, interaction.guildId);
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
				if (runMode !== "prod" || !member.user.bot) {
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

		const { toastId, rewardedHunterIds, rewardTexts, critValue } = await raiseToast(interaction.guild, company, interaction.member, sender, nonBotToasteeIds, toastText, imageURL);
		const embeds = [
			new EmbedBuilder().setColor("e5b271")
				.setThumbnail(company.toastThumbnailURL ?? 'https://cdn.discordapp.com/attachments/545684759276421120/751876927723143178/glass-celebration.png')
				.setTitle(toastText)
				.setDescription(`A toast to ${listifyEN(nonBotToasteeIds.map(id => userMention(id)))}!`)
				.setFooter({ text: interaction.member.displayName, iconURL: interaction.user.avatarURL() })
		];
		if (imageURL) {
			embeds[0].setImage(imageURL);
		}

		if (rewardedHunterIds.length > 0) {
			const goalUpdate = await progressGoal(interaction.guild.id, "toasts", interaction.user.id);
			if (goalUpdate.gpContributed > 0) {
				rewardTexts.push(`This toast contributed ${goalUpdate.gpContributed} GP to the Server Goal!`);
				if (goalUpdate.goalCompleted) {
					embeds.push(new EmbedBuilder().setColor("e5b271")
						.setTitle("Server Goal Completed")
						.setThumbnail("https://cdn.discordapp.com/attachments/673600843630510123/1309260766318166117/trophy-cup.png?ex=6740ef9b&is=673f9e1b&hm=218e19ede07dcf85a75ecfb3dde26f28adfe96eb7b91e89de11b650f5c598966&")
						.setDescription(`${congratulationBuilder()}, the Server Goal was completed! Contributors have double chance to find items on their next bounty completion.`)
						.addFields({ name: "Contributors", value: listifyEN(goalUpdate.contributorIds.map(id => userMention(id))) })
					);
				}
				const { goalId, currentGP, requiredGP } = await findLatestGoalProgress(interaction.guild.id);
				if (goalId !== null) {
					embeds[0].addFields({ name: "Server Goal", value: `${generateTextBar(currentGP, requiredGP, 15)} ${Math.min(currentGP, requiredGP)}/${requiredGP} GP` });
				} else {
					embeds[0].addFields({ name: "Server Goal", value: `${generateTextBar(15, 15, 15)} Completed!` });
				}
			}
		}

		interaction.reply({
			embeds,
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId(`secondtoast${SAFE_DELIMITER}${toastId}`)
						.setLabel("Hear, hear!")
						.setEmoji("🥂")
						.setStyle(ButtonStyle.Primary)
				)
			],
			withResponse: true
		}).then(async response => {
			let content = "";
			if (rewardedHunterIds.length > 0) {
				const rankUpdates = await getRankUpdates(interaction.guild, database);
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
				updateScoreboard(company, interaction.guild, database);
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
);
