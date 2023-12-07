const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { Op } = require('sequelize');
const { SAFE_DELIMITER, MAX_MESSAGE_CONTENT_LENGTH } = require('../constants');
const { CommandWrapper } = require('../classes');
const { getNumberEmoji, extractUserIdsFromMentions, checkTextsInAutoMod, timeConversion } = require('../util/textUtil');
const { getRankUpdates } = require('../util/scoreUtil');
const { updateScoreboard } = require('../util/embedUtil');

const mainId = "toast";
const options = [
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
];
const subcommands = [];
module.exports = new CommandWrapper(mainId, "Raise a toast to other bounty hunter(s), usually granting +1 XP", PermissionFlagsBits.SendMessages, false, false, 30000, options, subcommands,
	/** Provide 1 XP to mentioned hunters up to author's quota (10/48 hours), roll for crit toast (grants author XP) */
	async (interaction, database, runMode) => {
		const errors = [];

		// Find valid toastees
		const toasteeIds = extractUserIdsFromMentions(interaction.options.getString(options[0].name), [interaction.user.id]);

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

		const embed = new EmbedBuilder();

		// Validate image-url is a URL
		const imageURL = interaction.options.getString(options[2].name);
		try {
			if (imageURL) {
				new URL(imageURL);
				embed.setImage(imageURL);
			}
		} catch (error) {
			errors.push(error.message);
		}

		// Early-out if any errors
		if (errors.length > 0) {
			interaction.reply({ content: `The following errors were encountered while raising your toast:\n- ${errors.join("\n- ")}`, ephemeral: true });
			return;
		}

		const toastText = interaction.options.getString(options[1].name);
		const isBlockedByAutoMod = await checkTextsInAutoMod(interaction.channel, interaction.member, [toastText], "toast");
		if (isBlockedByAutoMod) {
			interaction.reply({ content: "Your toast was blocked by AutoMod.", ephemeral: true });
			return;
		}

		// Build rest of embed
		embed.setColor("e5b271")
			.setThumbnail('https://cdn.discordapp.com/attachments/545684759276421120/751876927723143178/glass-celebration.png')
			.setTitle(toastText)
			.setDescription(`A toast to <@${nonBotToasteeIds.join(">, <@")}>!`)
			.setFooter({ text: interaction.member.displayName, iconURL: interaction.user.avatarURL() });

		// Make database entities
		const recentToasts = await database.models.Toast.findAll({ where: { companyId: interaction.guildId, senderId: interaction.user.id, createdAt: { [Op.gt]: new Date(new Date() - 2 * timeConversion(1, "d", "ms")) } }, include: database.models.Toast.Recipients });
		let rewardsAvailable = 10;
		let critToastsAvailable = 2;
		for (const toast of recentToasts) {
			for (const reciept of toast.Recipients) {
				if (reciept.isRewarded) {
					rewardsAvailable--;
				}
				if (reciept.wasCrit) {
					critToastsAvailable--;
				}
			}
		}
		const toastsInLastDay = recentToasts.filter(toast => new Date(toast.createdAt) > new Date(new Date() - timeConversion(1, "d", "ms")));
		const hunterIdsToastedInLastDay = toastsInLastDay.reduce((idSet, toast) => {
			toast.Recipients.forEach(reciept => {
				if (!idSet.has(reciept.recipientId)) {
					idSet.add(reciept.recipientId);
				}
			})
			return idSet;
		}, new Set());

		const lastFiveToasts = await database.models.Toast.findAll({ where: { companyId: interaction.guildId, senderId: interaction.user.id }, include: database.models.Toast.Recipients, order: [["createdAt", "DESC"]], limit: 5 });
		const staleToastees = lastFiveToasts.reduce((list, toast) => {
			return list.concat(toast.Recipients.filter(reciept => reciept.isRewarded).map(reciept => reciept.recipientId));
		}, []);

		const rawRecipients = [];
		const rewardedRecipients = [];
		let critValue = 0;
		//TODO #96 combine fetch and toastsRaised increment with upsert?
		const [company] = await database.models.Company.findOrCreate({ where: { id: interaction.guildId } });
		const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
		season.increment("toastsRaised");
		await database.models.User.findOrCreate({ where: { id: interaction.user.id } });
		const [sender] = await database.models.Hunter.findOrCreate({ where: { userId: interaction.user.id, companyId: interaction.guildId } });
		sender.toastsRaised++;
		const toast = await database.models.Toast.create({ companyId: interaction.guildId, senderId: interaction.user.id, text: toastText, imageURL });
		for (const id of nonBotToasteeIds) {
			//TODO #97 move to bulkCreate after finding solution to create by association only if user doesn't already exist
			const [user] = await database.models.User.findOrCreate({ where: { id } });
			const rawToast = { toastId: toast.id, recipientId: id, isRewarded: !hunterIdsToastedInLastDay.has(id) && rewardsAvailable > 0, wasCrit: false };
			if (rawToast.isRewarded) {
				rewardedRecipients.push(id);

				// Calculate crit
				if (critToastsAvailable > 0) {
					const critRoll = Math.random() * 100;

					let effectiveToastLevel = sender.level + 2;
					for (const recipientId of staleToastees) {
						if (id == recipientId) {
							effectiveToastLevel--;
							if (effectiveToastLevel < 2) {
								break;
							}
						}
					};

					// f(x) = 150/(x+2)^(1/3)
					if (critRoll * critRoll * critRoll > 3375000 / effectiveToastLevel) {
						rawToast.wasCrit = true;
						critValue += 1;
						critToastsAvailable--;
					}
				}

				rewardsAvailable--;
			}
			rawRecipients.push(rawToast);
		}
		database.models.Recipient.bulkCreate(rawRecipients);

		// Add XP and update ranks
		let levelTexts = [];
		const toasterLevelTexts = await sender.addXP(interaction.guild.name, critValue, false, database);
		if (toasterLevelTexts.length > 0) {
			levelTexts = levelTexts.concat(toasterLevelTexts);
		}
		for (const recipientId of rewardedRecipients) {
			const [hunter] = await database.models.Hunter.findOrCreate({ where: { userId: recipientId, companyId: interaction.guildId } });
			const toasteeLevelTexts = await hunter.addXP(interaction.guild.name, 1, false, database);
			if (toasteeLevelTexts.length > 0) {
				levelTexts = levelTexts.concat(toasteeLevelTexts);
			}
			hunter.increment("toastsReceived");
		}

		interaction.reply({
			embeds: [embed],
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId(`secondtoast${SAFE_DELIMITER}${toast.id}`)
						.setLabel("Seconded!")
						.setEmoji(getNumberEmoji(2))
						.setStyle(ButtonStyle.Primary)
				)
			],
			fetchReply: true
		}).then(message => {
			message.startThread({ name: "Rewards" }).then(thread => {
				if (rewardedRecipients.length > 0) {
					getRankUpdates(interaction.guild, database).then(rankUpdates => {
						const multiplierString = company.festivalMultiplierString();
						let text = `__**XP Gained**__\n${rewardedRecipients.map(id => `<@${id}> + 1 XP${multiplierString}`).join("\n")}${critValue > 0 ? `\n${interaction.member} + ${critValue} XP${multiplierString}` : ""}`;
						if (rankUpdates.length > 0) {
							text += `\n\n__**Rank Ups**__\n- ${rankUpdates.join("\n- ")}`;
						}
						if (levelTexts.length > 0) {
							text += `\n\n__**Rewards**__\n- ${levelTexts.join("\n- ")}`;
						}
						if (text.length > MAX_MESSAGE_CONTENT_LENGTH) {
							text = "Message overflow! Many people (?) probably gained many things (?). Use `/stats` to look things up.";
						}
						thread.send({ content: text, flags: MessageFlags.SuppressNotifications });
						updateScoreboard(company, interaction.guild, database);
					})
				}
			});
		});
	}
);
