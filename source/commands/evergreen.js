const { PermissionFlagsBits, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { Bounty } = require('../models/bounties/Bounty');
const { updateScoreboard } = require('../util/embedUtil');
const { getRankUpdates, generateBountyBoardThread } = require('../util/scoreUtil');
const { getNumberEmoji, extractUserIdsFromMentions, timeConversion, checkTextsInAutoMod, trimForSelectOptionDescription } = require('../util/textUtil');
const { MAX_MESSAGE_CONTENT_LENGTH, MAX_EMBEDS_PER_MESSAGE, MAX_EMBED_TITLE_LENGTH } = require('../constants');

const mainId = "evergreen";
const options = [];
const subcommands = [
	{
		name: "post",
		description: "Post an evergreen bounty, limit 10"
	},
	{
		name: "edit",
		description: "Change the name, description, or image of an evergreen bounty"
	},
	{
		name: "swap",
		description: "Swap the rewards of two evergreen bounties"
	},
	{
		name: "showcase",
		description: "Show the embed for an evergreen bounty"
	},
	{
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
	{
		name: "take-down",
		description: "Take down one of your bounties without awarding XP (forfeit posting XP)"
	}
];
module.exports = new CommandWrapper(mainId, "Evergreen Bounties are not closed after completion; ideal for server-wide objectives", PermissionFlagsBits.ManageChannels, true, false, 3000, options, subcommands,
	(interaction, database, runMode) => {
		let slotNumber;
		switch (interaction.options.getSubcommand()) {
			case subcommands[0].name: // post
				database.models.Bounty.findAll({ where: { isEvergreen: true, companyId: interaction.guildId, state: "open" } }).then(existingBounties => {
					let slotNumber = null;
					for (let slotCandidate = 1; slotCandidate <= MAX_EMBEDS_PER_MESSAGE; slotCandidate++) {
						if (!existingBounties.some(bounty => bounty.slotNumber === slotCandidate)) {
							slotNumber = slotCandidate;
							break;
						}
					}

					if (slotNumber === null) {
						interaction.reply({ content: "Each server can only have 10 Evergreen Bounties.", ephemeral: true });
						return;
					}

					interaction.showModal(
						new ModalBuilder().setCustomId("evergreenpost")
							.setTitle("New Evergreen Bounty")
							.addComponents(
								new ActionRowBuilder().addComponents(
									new TextInputBuilder().setCustomId("title")
										.setLabel("Title")
										.setStyle(TextInputStyle.Short)
										.setPlaceholder("Discord markdown allowed...")
										.setMaxLength(MAX_EMBED_TITLE_LENGTH)
								),
								new ActionRowBuilder().addComponents(
									new TextInputBuilder().setCustomId("description")
										.setLabel("Description")
										.setStyle(TextInputStyle.Paragraph)
										.setPlaceholder("Bounties with clear instructions are easier to complete...")
								),
								new ActionRowBuilder().addComponents(
									new TextInputBuilder().setCustomId("imageURL")
										.setLabel("Image URL")
										.setRequired(false)
										.setStyle(TextInputStyle.Short)
								)
							)
					);

					interaction.awaitModalSubmit({ filter: interaction => interaction.customId === "evergreenpost", time: timeConversion(5, "m", "ms") }).then(async interaction => {
						const title = interaction.fields.getTextInputValue("title");
						const description = interaction.fields.getTextInputValue("description");

						const isBlockedByAutoMod = await checkTextsInAutoMod(interaction.channel, interaction.member, [title, description], "evergreen post");
						if (isBlockedByAutoMod) {
							interaction.reply({ content: "Your evergreen bounty could not be posted because it tripped AutoMod.", ephemeral: true });
							return;
						}

						const rawBounty = {
							userId: interaction.client.user.id,
							companyId: interaction.guildId,
							slotNumber: parseInt(slotNumber),
							isEvergreen: true,
							title,
							description
						};

						const imageURL = interaction.fields.getTextInputValue("imageURL");
						if (imageURL) {
							try {
								new URL(imageURL);
								rawBounty.attachmentURL = imageURL;
							} catch (error) {
								interaction.message.edit({ components: [] });
								interaction.reply({ content: `The following errors were encountered while posting your bounty **${title}**:\n• ${error.message}`, ephemeral: true });
								return;
							}
						}

						const [company] = await database.models.Company.findOrCreate({ where: { id: interaction.guildId } });
						const bounty = await database.models.Bounty.create(rawBounty);

						// post in bounty board forum
						const bountyEmbed = await bounty.asEmbed(interaction.guild, company.level, company.festivalMultiplierString(), database);
						interaction.reply(company.sendAnnouncement({ content: `A new evergreen bounty has been posted:`, embeds: [bountyEmbed] })).then(() => {
							if (company.bountyBoardId) {
								interaction.guild.channels.fetch(company.bountyBoardId).then(async bountyBoard => {
									const evergreenBounties = await database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.client.user.id, state: "open" }, order: [["slotNumber", "ASC"]] });
									const embeds = await Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(interaction.guild, company.level, company.festivalMultiplierString(), database)));
									if (company.evergreenThreadId) {
										return bountyBoard.threads.fetch(company.evergreenThreadId).then(async thread => {
											const message = await thread.fetchStarterMessage();
											message.edit({ embeds });
											return thread;
										});
									} else {
										return generateBountyBoardThread(bountyBoard.threads, embeds, company);
									}
								}).then(thread => {
									bounty.postingId = thread.id;
									bounty.save()
								});
							} else {
								interaction.followUp({ content: "Looks like your server doesn't have a bounty board channel. Make one with `/create-default bounty-board-forum`?", ephemeral: true });
							}
						});
					}).catch(console.error)
				});
				break;
			case subcommands[1].name: // edit
				database.models.Bounty.findAll({ where: { userId: interaction.client.user.id, companyId: interaction.guildId, state: "open" } }).then(openBounties => {
					const slotOptions = openBounties.map(bounty => {
						return {
							emoji: getNumberEmoji(bounty.slotNumber),
							label: bounty.title,
							description: trimForSelectOptionDescription(bounty.description),
							value: bounty.id
						};
					});

					if (slotOptions.length < 1) {
						interaction.reply({ content: "This server doesn't seem to have any open evergreen bounties at the moment.", ephemeral: true });
						return;
					}

					interaction.reply({
						content: "Editing an evergreen bounty will not change previous completions.",
						components: [
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder().setCustomId("evergreenedit")
									.setPlaceholder("Select a bounty to edit...")
									.setMaxValues(1)
									.setOptions(slotOptions)
							)
						],
						ephemeral: true
					});
				})
				break;
			case subcommands[2].name: // swap
				database.models.Bounty.findAll({ where: { isEvergreen: true, companyId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] }).then(existingBounties => {
					if (existingBounties.length < 2) {
						interaction.reply({ content: "There must be at least 2 evergreen bounties for this server to swap.", ephemeral: true });
						return;
					}

					interaction.reply({
						content: "Swapping a bounty to another slot will change the XP reward for that bounty.",
						components: [
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder().setCustomId("evergreenswapbounty")
									.setPlaceholder("Select a bounty to swap...")
									.setMaxValues(1)
									.setOptions(existingBounties.map(bounty => ({
										emoji: getNumberEmoji(bounty.slotNumber),
										label: bounty.title,
										description: trimForSelectOptionDescription(bounty.description),
										value: bounty.id
									})))
							)
						],
						ephemeral: true
					});
				});
				break;
			case subcommands[3].name: // showcase
				database.models.Bounty.findAll({ where: { isEvergreen: true, companyId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] }).then(existingBounties => {
					if (existingBounties.length < 1) {
						interaction.reply({ content: "This server doesn't have any open evergreen bounties posted.", ephemeral: true });
						return;
					}

					interaction.reply({
						content: "Unlike normal bounty showcases, an evergreen showcase does not increase the reward of the showcased bounty and is not rate-limited.",
						components: [
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder().setCustomId("evergreenshowcase")
									.setPlaceholder("Select a bounty to showcase...")
									.setMaxValues(1)
									.setOptions(existingBounties.map(bounty => ({
										emoji: getNumberEmoji(bounty.slotNumber),
										label: bounty.title,
										description: trimForSelectOptionDescription(bounty.description),
										value: bounty.id
									})))
							)
						],
						ephemeral: true
					});
				});
				break;
			case subcommands[4].name: // complete
				slotNumber = interaction.options.getInteger("bounty-slot");
				database.models.Bounty.findOne({ where: { isEvergreen: true, companyId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
					if (!bounty) {
						interaction.reply({ content: "There isn't an evergreen bounty in the `bounty-slot` provided.", ephemeral: true });
						return;
					}

					const company = await database.models.Company.findByPk(interaction.guildId);
					const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });

					const mentionedIds = extractUserIdsFromMentions(interaction.options.getString("hunters"), []);

					if (mentionedIds.length < 1) {
						interaction.reply({ content: "Could not find any bounty hunter ids in `hunters`.", ephemeral: true })
						return;
					}

					const dedupedCompleterIds = [];
					for (const id of mentionedIds) {
						if (!dedupedCompleterIds.includes(id)) {
							dedupedCompleterIds.push(id);
						}
					}

					const validatedCompleterIds = [];
					const completerMembers = dedupedCompleterIds.length > 0 ? (await interaction.guild.members.fetch({ user: dedupedCompleterIds })).values() : [];
					let levelTexts = [];
					for (const member of completerMembers) {
						if (runMode !== "prod" || !member.user.bot) {
							const memberId = member.id;
							await database.models.User.findOrCreate({ where: { id: memberId } });
							const [hunter] = await database.models.Hunter.findOrCreate({
								where: { userId: memberId, companyId: interaction.guildId }
							});
							if (!hunter.isBanned) {
								validatedCompleterIds.push(memberId);
							}
						}
					}

					if (validatedCompleterIds.length < 1) {
						interaction.reply({ content: "There aren't any eligible bounty hunters to credit with completing this evergreen bounty.", ephemeral: true })
						return;
					}

					season.increment("bountiesCompleted");

					const rawCompletions = [];
					for (const userId of dedupedCompleterIds) {
						rawCompletions.push({
							bountyId: bounty.id,
							userId,
							companyId: interaction.guildId
						});
					}
					await database.models.Completion.bulkCreate(rawCompletions);

					// Evergreen bounties are not eligible for showcase bonuses
					const bountyValue = Bounty.calculateReward(company.level, slotNumber, 0) * company.eventMultiplier;
					database.models.Completion.update({ xpAwarded: bountyValue }, { where: { bountyId: bounty.id } });

					for (const userId of validatedCompleterIds) {
						const hunter = await database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId } });
						const completerLevelTexts = await hunter.addXP(interaction.guild.name, bountyValue, true, database);
						if (completerLevelTexts.length > 0) {
							levelTexts = levelTexts.push(completerLevelTexts);
						}
						hunter.othersFinished++;
						hunter.save();
					}

					bounty.asEmbed(interaction.guild, company.level, company.festivalMultiplierString(), database).then(embed => {
						return interaction.reply({ embeds: [embed], fetchReply: true });
					}).then(replyMessage => {
						getRankUpdates(interaction.guild, database).then(rankUpdates => {
							replyMessage.startThread({ name: `${bounty.title} Rewards` }).then(thread => {
								const multiplierString = company.festivalMultiplierString();
								let text = `__**XP Gained**__\n${validatedCompleterIds.map(id => `<@${id}> + ${bountyValue} XP${multiplierString}`).join("\n")}`;
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
							})
							updateScoreboard(company, interaction.guild, database);
						});
					})
				})
				break;
			case subcommands[5].name: // take-down
				database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.client.user.id, state: "open" }, order: [["slotNumber", "ASC"]] }).then(openBounties => {
					const bountyOptions = openBounties.map(bounty => {
						return {
							emoji: getNumberEmoji(bounty.slotNumber),
							label: bounty.title,
							description: trimForSelectOptionDescription(bounty.description),
							value: bounty.id
						};
					});

					interaction.reply({
						content: "If you'd like to change the title, description, or image of an evergreen bounty, you can use `/evergreen edit` instead.",
						components: [
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder().setCustomId("evergreentakedown")
									.setPlaceholder("Select a bounty to take down...")
									.setMaxValues(1)
									.setOptions(bountyOptions)
							)
						],
						ephemeral: true
					});
				})
				break;
		}
	}
);
