const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { SAFE_DELIMITER } = require('../constants');
const { getNumberEmoji, getRankUpdates } = require('../helpers');
const { database } = require('../../database');
const { Op } = require('sequelize');

const DAY_IN_MS = 86400000;

const customId = "toast";
const options = [
	{
		type: "String",
		name: "toastees",
		description: "The mention(s) of the bounty hunter(s) to whom you are raising a toast",
		required: true,
		choices: []
	},
	{
		type: "String",
		name: "message",
		description: "The text of the toast to raise",
		required: true,
		choices: []
	},
	{
		type: "String",
		name: "image-url",
		description: "The URL to the image to add to the toast",
		required: false,
		choices: []
	}
];
const subcommands = [];
module.exports = new CommandWrapper(customId, "Raise a toast to other bounty hunter(s), usually granting +1 XP", PermissionFlagsBits.SendMessages, false, false, 30000, options, subcommands,
	/** Provide 1 XP to mentioned hunters up to author's quota (10/48 hours), roll for crit toast (grants author XP) */
	async (interaction) => {
		const errors = [];

		// Find valid toastees
		const idRegExp = RegExp(/<@(\d+)>/, "g");
		const toasteeIds = [];
		let results;
		while ((results = idRegExp.exec(interaction.options.getString(options[0].name))) != null) {
			const id = results[1];
			if (id != interaction.user.id) {
				toasteeIds.push(id);
			}
		}

		if (toasteeIds.length < 1) { //TODONOW filter out bots
			errors.push("Could not parse any user mentions from `toastees`.");
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
		embed.setColor("e5b271")
			.setThumbnail('https://cdn.discordapp.com/attachments/545684759276421120/751876927723143178/glass-celebration.png')
			.setTitle(toastText)
			.setDescription(`A toast to <@${toasteeIds.join(">, <@")}>!`)
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
		const hunterIdsToastedInLastDay = await toastsInLastDay.reduce(async (list, toast) => {
			(await toast.recipients).forEach(recipient => {
				if (!list.has(recipient.recipientId)) {
					list.add(recipient.recipientId);
				}
			})
			return list;
		}, new Set());

		const lastFiveToasts = await database.models.Toast.findAll({ order: [["createdAt", "DESC"]], limit: 5 });
		//TODONOW prevent flushing rewarded staleToastees with trash toasts
		const staleToastees = lastFiveToasts.reduce(async (list, toast) => {
			return (await list).concat((await toast.recipients).map(recipient => recipient.recipientId));
		}, []);

		const recipientPayloads = []; //TODONOW look up technical term for object used to build entity
		let rewardedRecipients = [];
		let critValue = 0;
		let guildProfile = await database.models.Guild.findByPk(interaction.guildId);
		if (!guildProfile) {
			//TODO use findOrCreate after double-checking associations (may not cascade from hunter to user correctly)
			guildProfile = database.models.Guild.create({ id: interaction.guildId });
		}
		let sender = await database.models.Hunter.findOne({ where: { userId: interaction.user.id, guildId: interaction.guildId } });
		if (!sender) {
			//TODO use findOrCreate after double-checking associations (may not cascade from hunter to user correctly)
			const user = await database.models.User.findByPk(interaction.user.id);
			if (!user) {
				await database.models.User.create({ id: interaction.user.id });
			}
			sender = await database.models.Hunter.create({ userId: interaction.user.id, guildId: interaction.guildId, isRankEligible: !interaction.member.manageable });
		}
		sender.toastsRaised++;
		const toast = await database.models.Toast.create({ guildId: interaction.guildId, senderId: interaction.user.id, text: toastText, imageURL });
		for (const id of toasteeIds) {
			//TODONOW look up technical term for object used to build entity
			const payload = { toastId: toast.id, recipientId: id, isRewarded: !hunterIdsToastedInLastDay.has(id) && rewardsAvailable > 0, wasCrit: false };
			if (payload.isRewarded) {
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
						payload.wasCrit = true;
						critValue += 1;
					}
				}

				rewardsAvailable--;
			}
			recipientPayloads.push(payload);
		}
		database.models.ToastRecipient.bulkCreate(recipientPayloads);

		// Add XP and update ranks
		const levelTexts = [];
		levelTexts.concat(await sender.addXP(interaction.guild, critValue, false));
		for (const recipientId of rewardedRecipients) {
			let hunter = await database.models.Hunter.findOne({ where: { userId: recipientId, guildId: interaction.guildId } });
			if (!hunter) {
				//TODO use findOrCreate after double-checking associations (may not cascade from hunter to user correctly)
				const user = await database.models.User.findByPk(recipientId);
				if (!user) {
					await database.models.User.create({ id: recipientId });
				}
				const member = await interaction.guild.members.fetch(recipientId);
				hunter = await database.models.Hunter.create({ userId: recipientId, guildId: interaction.guildId, isRankEligible: !member.manageable });
			}
			levelTexts.concat(await hunter.addXP(interaction.guild, 1, false));
		}

		interaction.reply({
			embeds: [embed],
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId(`secondtoast${SAFE_DELIMITER}${"toastId"}`)
						.setLabel("I second this toast!")
						.setEmoji(getNumberEmoji(2))
						.setStyle(ButtonStyle.Primary)
				)
			],
			fetchReply: true
		}).then(message => {
			return message.startThread({ name: "Rewards" });
		}).then(thread => {
			getRankUpdates(interaction.guild).then(rankUpdates => {
				const multiplierString = guildProfile.eventMultiplierString();
				let text = "";
				if (rankUpdates.length > 0) {
					text += `\n__**Rank Ups**__\n${rankUpdates.join("\n")}`;
				}
				text += `__**XP Gained**__\n${rewardedRecipients.map(id => `<@${id}> + 1 XP${multiplierString}`).join("\n")}${critValue > 0 ? `\n${interaction.member} + 1 XP${multiplierString}` : ""}`;
				if (levelTexts.length > 0) {
					text += `\n__**Rewards**__\n${levelTexts.filter(text => Boolean(text)).join("\n")}`;
				}
				if (text.length > 2000) {
					text = "Message overflow! Many people (?) probably gained many things (?). Use `/stats` to look things up.";
				}
				thread.send(text);
			})
		});
	}
);
