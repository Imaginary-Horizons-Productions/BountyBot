const { PermissionFlagsBits, InteractionContextType, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { extractUserIdsFromMentions, textsHaveAutoModInfraction } = require('../util/textUtil');
const { raiseToast } = require('../logic/toasts.js');
const { updateScoreboard } = require('../util/embedUtil.js');
const { SAFE_DELIMITER, MAX_MESSAGE_CONTENT_LENGTH } = require('../constants.js');
const { findOrCreateCompany } = require('../logic/companies.js');
const { findOrCreateBountyHunter } = require('../logic/hunters.js');
const { getRankUpdates } = require('../util/scoreUtil.js');

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

		const { toastId, rewardedHunterIds, rewardTexts, critValue, embeds } = await raiseToast(interaction.guild, company, interaction.member, sender, nonBotToasteeIds, toastText, imageURL);
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
				const multiplierString = company.festivalMultiplierString();
				content = `__**XP Gained**__\n${rewardedHunterIds.map(id => `<@${id}> + 1 XP${multiplierString}`).join("\n")}${critValue > 0 ? `\n${interaction.member} + ${critValue} XP${multiplierString} *Critical Toast!*` : ""}`;
				if (rankUpdates.length > 0) {
					content += `\n\n__**Rank Ups**__\n- ${rankUpdates.join("\n- ")}`;
				}
				if (rewardTexts.length > 0) {
					content += `\n\n__**Rewards**__\n- ${rewardTexts.join("\n- ")}`;
				}
				if (content.length > MAX_MESSAGE_CONTENT_LENGTH) {
					content = `Message overflow! Many people (?) probably gained many things (?). Use ${commandMention("stats")} to look things up.`;
				}
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
