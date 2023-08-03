const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { SAFE_DELIMITER, DAY_IN_MS } = require('../constants');
const { getNumberEmoji, getRankUpdates, extractUserIdsFromMentions } = require('../helpers');
const { database } = require('../../database');
const { Op } = require('sequelize');
const { updateScoreboard } = require('../embedHelpers');

const customId = "toast";
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
module.exports = new CommandWrapper(customId, "Raise a toast to other bounty hunter(s), usually granting +1 XP", PermissionFlagsBits.SendMessages, false, false, 30000, options, subcommands,
	/** Provide 1 XP to mentioned hunters up to author's quota (10/48 hours), roll for crit toast (grants author XP) */
	async (interaction) => {
		const errors = [];

		// Find valid toastees
		const toasteeIds = extractUserIdsFromMentions(interaction.options.getString(options[0].name), [interaction.user.id]);

		const nonBotToasteeIds = [];
		if (toasteeIds.length < 1) {
			errors.push("Could not parse any user mentions from `toastees`.");
		} else {
			const toasteeMembers = (await interaction.guild.members.fetch({ user: toasteeIds })).values();
			for (const member of toasteeMembers) {
				if (!member.user.bot) {
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

		// Build rest of embed
		const toastText = interaction.options.getString(options[1].name);
		embed.setColor("e5b271") //TODO #42
			.setThumbnail('https://cdn.discordapp.com/attachments/545684759276421120/751876927723143178/glass-celebration.png')
			.setTitle(toastText)
			.setDescription(`A toast to <@${nonBotToasteeIds.join(">, <@")}>!`)
			.setFooter({ text: interaction.member.displayName, iconURL: interaction.user.avatarURL() });

		// Make database entities
		const recentToasts = await database.models.Toast.findAll({ where: { guildId: interaction.guildId, senderId: interaction.user.id, createdAt: { [Op.gt]: new Date(new Date() - 2 * DAY_IN_MS) } } });
		let rewardsAvailable = 10;
		let critToastsAvailable = 2;
		for (const toast of recentToasts) {
			rewardsAvailable -= (await toast.rewardedRecipients).length;
			for (const reciept of await toast.recipients) {
				if (reciept.wasCrit) {
					critToastsAvailable--;
				}
			}
		}
		const toastsInLastDay = recentToasts.filter(toast => new Date(toast.createdAt) > new Date(new Date() - DAY_IN_MS));
		const hunterIdsToastedInLastDay = await toastsInLastDay.reduce(async (listPromise, toast) => {
			const list = await listPromise;
			(await toast.recipients).forEach(reciept => {
				if (!list.has(reciept.recipientId)) {
					list.add(reciept.recipientId);
				}
			})
			return list;
		}, new Promise((resolve) => { resolve(new Set()) }));

		const lastFiveToasts = await database.models.Toast.findAll({ where: { guildId: interaction.guildId, senderId: interaction.user.id }, order: [["createdAt", "DESC"]], limit: 5 });
		const staleToastees = await lastFiveToasts.reduce(async (list, toast) => {
			return (await list).concat((await toast.rewardedRecipients).map(reciept => reciept.recipientId));
		}, new Promise((resolve) => { resolve([]) }));

		const rawRecipients = [];
		let rewardedRecipients = [];
		let critValue = 0;
		//TODO combine fetch and seasonToasts increment with upsert?
		const [guildProfile] = await database.models.Guild.findOrCreate({ where: { id: interaction.guildId } });
		guildProfile.increment("seasonToasts");
		const [user] = await database.models.User.findOrCreate({ where: { id: interaction.user.id } });
		const [sender] = await database.models.Hunter.findOrCreate({ where: { userId: interaction.user.id, guildId: interaction.guildId }, defaults: { isRankEligible: interaction.member.manageable } });
		sender.toastsRaised++;
		const toast = await database.models.Toast.create({ guildId: interaction.guildId, senderId: interaction.user.id, text: toastText, imageURL });
		for (const id of nonBotToasteeIds) {
			//TODO move to bulkCreate when create by association is working
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
		database.models.ToastRecipient.bulkCreate(rawRecipients);

		// Add XP and update ranks
		const levelTexts = [];
		levelTexts.concat(await sender.addXP(interaction.guild, critValue, false));
		for (const recipientId of rewardedRecipients) {
			const member = await interaction.guild.members.fetch(recipientId);
			const [hunter] = await database.models.Hunter.findOrCreate({ where: { userId: recipientId, guildId: interaction.guildId }, defaults: { isRankEligible: member.manageable } });
			levelTexts.concat(await hunter.addXP(interaction.guild, 1, false));
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
					getRankUpdates(interaction.guild).then(rankUpdates => {
						const multiplierString = guildProfile.eventMultiplierString();
						let text = "";
						if (rankUpdates.length > 0) {
							text += `\n__**Rank Ups**__\n${rankUpdates.join("\n")}\n`;
						}
						text += `__**XP Gained**__\n${rewardedRecipients.map(id => `<@${id}> + 1 XP${multiplierString}`).join("\n")}${critValue > 0 ? `\n${interaction.member} + ${critValue} XP${multiplierString}` : ""}\n`;
						if (levelTexts.length > 0) {
							text += `\n__**Rewards**__\n${levelTexts.filter(text => Boolean(text)).join("\n")}`;
						}
						if (text.length > 2000) {
							text = "Message overflow! Many people (?) probably gained many things (?). Use `/stats` to look things up.";
						}
						thread.send(text);
						updateScoreboard(guildProfile, interaction.guild);
					})
				}
			});
		});
	}
);
