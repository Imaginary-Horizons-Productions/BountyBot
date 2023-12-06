const { PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { updateScoreboard } = require('../util/embedUtil');
const { getRankUpdates } = require('../util/scoreUtil');
const { getNumberEmoji, extractUserIdsFromMentions, timeConversion, trimForSelectOptionDescription } = require('../util/textUtil');
const { Op } = require('sequelize');
const { Bounty } = require('../models/bounties/Bounty');
const { MAX_MESSAGE_CONTENT_LENGTH } = require('../constants');

const mainId = "bounty";
const options = [];
const subcommands = [
	{
		name: "post",
		description: "Post your own bounty (+1 XP)"
	},
	{
		name: "edit",
		description: "Edit the title, description, image, or time of one of your bounties"
	},
	{
		name: "swap",
		description: "Move one of your bounties to another slot to change its reward"
	},
	{
		name: "showcase",
		description: "Show the embed for one of your existing bounties and increase the reward"
	},
	{
		name: "add-completers",
		description: "Add hunter(s) to a bounty's list of completers",
		optionsInput: [
			{
				type: "Integer",
				name: "bounty-slot",
				description: "The slot number of the bounty to add completers to",
				required: true
			},
			{
				type: "String",
				name: "hunters",
				description: "The bounty hunter(s) to add as completer(s)",
				required: true
			}
		]
	},
	{
		name: "remove-completers",
		description: "Remove hunter(s) from a bounty's list of completers",
		optionsInput: [
			{
				type: "Integer",
				name: "bounty-slot",
				description: "The slot number of the bounty from which to remove completers",
				required: true
			},
			{
				type: "String",
				name: "hunters",
				description: "The bounty hunter(s) to remove",
				required: true
			}
		]
	},
	{
		name: "complete",
		description: "Close one of your open bounties, awarding XP to completers",
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
				required: false
			}
		]
	},
	{
		name: "take-down",
		description: "Take down one of your bounties without awarding XP (forfeit posting XP)"
	},
	{
		name: "list",
		description: "List all of a hunter's open bounties (default: your own)",
		optionsInput: [
			{
				type: "User",
				name: "bounty-hunter",
				description: "The bounty hunter to show open bounties for",
				required: false
			}
		]
	}
];
module.exports = new CommandWrapper(mainId, "Bounties are user-created objectives for other server members to complete", PermissionFlagsBits.SendMessages, false, false, 3000, options, subcommands,
	(interaction, database, runMode) => {
		let slotNumber;
		switch (interaction.options.getSubcommand()) {
			case subcommands[0].name: // post
				database.models.Company.findOrCreate({ where: { id: interaction.guildId } }).then(async ([{ maxSimBounties }]) => {
					const userId = interaction.user.id;
					await database.models.User.findOrCreate({ where: { id: userId } });
					const [hunter] = await database.models.Hunter.findOrCreate({
						where: { userId, companyId: interaction.guildId }
					});
					const existingBounties = await database.models.Bounty.findAll({ where: { userId, companyId: interaction.guildId, state: "open" } });
					const occupiedSlots = existingBounties.map(bounty => bounty.slotNumber);
					const bountySlots = hunter.maxSlots(maxSimBounties);
					const slotOptions = [];
					for (let slotNumber = 1; slotNumber <= bountySlots; slotNumber++) {
						if (!occupiedSlots.includes(slotNumber)) {
							slotOptions.push({
								emoji: getNumberEmoji(slotNumber),
								label: `Slot ${slotNumber}`,
								description: `Reward: ${Bounty.calculateReward(hunter.level, slotNumber, 0)} XP`,
								value: slotNumber.toString()
							})
						}
					}

					if (slotOptions.length > 0) {
						interaction.reply({
							content: "You can post a bounty for other server members to help out with. Here's some examples:\n\t• __Party Up__ Get bounty hunters to join you for a game session\n\t• __WTB/WTS__ Get the word out your looking to trade\n\t• __Achievement Get__ Get help working toward an achievement\n\nTo make a bounty, you'll need:\n\t• a title\n\t• a description\nOptionally, you can also add:\n\t• a url for an image\n\t• a start and end time (to make an event to go with your bounty)\n\nKeep in mind that while you're in charge of adding completers and ending the bounty, the bounty is still subject to server rules and moderation.",
							components: [
								new ActionRowBuilder().addComponents(
									new StringSelectMenuBuilder().setCustomId("bountypost")
										.setPlaceholder("XP awarded depends on slot used...")
										.setMaxValues(1)
										.setOptions(slotOptions)
								)
							],
							ephemeral: true
						});
					} else {
						interaction.reply({ content: "You don't seem to have any open bounty slots at the moment.", ephemeral: true });
					}
				});
				break;
			case subcommands[1].name: // edit
				database.models.Bounty.findAll({ where: { userId: interaction.user.id, companyId: interaction.guildId, state: "open" } }).then(openBounties => {
					if (openBounties.length < 1) {
						interaction.reply({ content: "You don't seem to have any open bounties at the moment.", ephemeral: true });
						return;
					}

					interaction.reply({
						content: "You can select one of your open bounties to edit below.\n\nKeep in mind that while you're in charge of adding completers and ending the bounty, the bounty is still subject to server rules and moderation.",
						components: [
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder().setCustomId("bountyedit")
									.setPlaceholder("Select a bounty to edit...")
									.setMaxValues(1)
									.setOptions(openBounties.map(bounty => ({
										emoji: getNumberEmoji(bounty.slotNumber),
										label: bounty.title,
										description: trimForSelectOptionDescription(bounty.description),
										value: bounty.id
									})))
							)
						],
						ephemeral: true
					});
				})
				break;
			case subcommands[2].name: // swap
				database.models.Bounty.findAll({ where: { userId: interaction.user.id, companyId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] }).then(openBounties => {
					if (openBounties.length < 1) {
						interaction.reply({ content: "You don't seem to have any open bounties at the moment.", ephemeral: true });
						return;
					}

					interaction.reply({
						content: "Swapping a bounty to another slot will change the XP reward for that bounty.",
						components: [
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder().setCustomId("bountyswapbounty")
									.setPlaceholder("Select a bounty to swap...")
									.setMaxValues(1)
									.setOptions(openBounties.map(bounty => ({
										emoji: getNumberEmoji(bounty.slotNumber),
										label: bounty.title,
										description: trimForSelectOptionDescription(bounty.description),
										value: bounty.id
									})))
							)
						],
						ephemeral: true
					});
				})
				break;
			case subcommands[3].name: // showcase
				database.models.Hunter.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId } }).then(async hunter => {
					const nextShowcaseInMS = new Date(hunter.lastShowcaseTimestamp).valueOf() + timeConversion(1, "w", "ms");
					if (Date.now() < nextShowcaseInMS) {
						interaction.reply({ content: `You can showcase another bounty in <t:${Math.floor(nextShowcaseInMS / 1000)}:R>.`, ephemeral: true });
						return;
					}

					const existingBounties = await database.models.Bounty.findAll({ where: { userId: interaction.user.id, companyId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] });
					if (existingBounties.length < 1) {
						interaction.reply({ content: "You doesn't have any open bounties posted.", ephemeral: true });
						return;
					}

					interaction.reply({
						content: "You can showcase 1 bounty per week. The showcased bounty's XP reward will be increased.",
						components: [
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder().setCustomId("bountyshowcase")
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
				})
				break;
			case subcommands[4].name: // add-completers
				slotNumber = interaction.options.getInteger("bounty-slot");
				database.models.Bounty.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
					if (!bounty) {
						interaction.reply({ content: "You don't have a bounty in the `bounty-slot` provided.", ephemeral: true });
						return;
					}

					const completerIds = extractUserIdsFromMentions(interaction.options.getString("hunters"), [interaction.user.id]);
					const validatedCompleterIds = [];
					if (completerIds.length < 1) {
						interaction.reply({ content: "Could not find any user mentions in `hunters` (you can't add yourself).", ephemeral: true });
						return;
					}

					const completerMembers = (await interaction.guild.members.fetch({ user: completerIds })).values();
					const existingCompletions = await database.models.Completion.findAll({ where: { bountyId: bounty.id, companyId: interaction.guildId } });
					const existingCompleterIds = existingCompletions.map(completion => completion.userId);
					const bannedIds = [];
					for (const member of completerMembers) {
						const memberId = member.id;
						if (!existingCompleterIds.includes(memberId)) {
							await database.models.User.findOrCreate({ where: { id: memberId } });
							const [hunter] = await database.models.Hunter.findOrCreate({
								where: { userId: memberId, companyId: interaction.guildId }
							});
							if (hunter.isBanned) {
								bannedIds.push(memberId);
								continue;
							}
							if (runMode !== "prod" || !member.user.bot) {
								existingCompleterIds.push(memberId);
								validatedCompleterIds.push(memberId);
							}
						}
					}

					if (validatedCompleterIds.length < 1) {
						interaction.reply({ content: "Could not find any new non-bot mentions in `hunters`.", ephemeral: true });
						return;
					}

					const rawCompletions = [];
					for (const userId of validatedCompleterIds) {
						rawCompletions.push({
							bountyId: bounty.id,
							userId,
							companyId: interaction.guildId
						})
					}
					database.models.Completion.bulkCreate(rawCompletions);
					const company = await database.models.Company.findByPk(interaction.guildId);
					bounty.updatePosting(interaction.guild, company, database);

					interaction.reply({
						content: `The following bounty hunters have been added as completers to **${bounty.title}**: <@${validatedCompleterIds.join(">, <@")}>\n\nThey will recieve the reward XP when you \`/bounty complete\`.${bannedIds.length > 0 ? `\n\nThe following users were not added, due to currently being banned from using BountyBot: <@${bannedIds.join(">, ")}>` : ""}`,
						ephemeral: true
					});
				})
				break;
			case subcommands[5].name: // remove-completers
				slotNumber = interaction.options.getInteger("bounty-slot");
				database.models.Bounty.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
					if (!bounty) {
						interaction.reply({ content: "You don't have a bounty in the `bounty-slot` provided.", ephemeral: true });
						return;
					}

					const mentionedIds = extractUserIdsFromMentions(interaction.options.getString("hunters"), []);
					if (mentionedIds.length < 1) {
						interaction.reply({ content: "Could not find any user mentions in `hunters`.", ephemeral: true });
						return;
					}

					database.models.Completion.destroy({ where: { bountyId: bounty.id, userId: { [Op.in]: mentionedIds } } });
					const company = await database.models.Company.findByPk(interaction.guildId);
					bounty.updatePosting(interaction.guild, company, database);

					interaction.reply({ //TODO #95 make sure acknowledging interactions is sharding safe
						content: `The following bounty hunters have been removed as completers from **${bounty.title}**: <@${mentionedIds.join(">, ")}>`,
						ephemeral: true
					});
				})
				break;
			case subcommands[6].name: // complete
				slotNumber = interaction.options.getInteger("bounty-slot");
				database.models.Bounty.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
					if (!bounty) {
						interaction.reply({ content: "You don't have a bounty in the `bounty-slot` provided.", ephemeral: true });
						return;
					}

					// disallow completion within 5 minutes of creating bounty
					if (runMode === "prod" && new Date() < new Date(new Date(bounty.createdAt) + timeConversion(5, "m", "ms"))) {
						interaction.reply({ content: "Bounties cannot be completed within 5 minutes of their posting. You can `/bounty add-completers` so you won't forget instead.", ephemeral: true });
						return;
					}

					// poster guaranteed to exist, creating a bounty gives 1 XP
					const poster = await database.models.Hunter.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId } });
					const company = await database.models.Company.findByPk(interaction.guildId);
					const season = await database.models.Season.findOne({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
					const bountyValue = Bounty.calculateReward(poster.level, slotNumber, bounty.showcaseCount) * company.eventMultiplier;

					const allCompleterIds = (await database.models.Completion.findAll({ where: { bountyId: bounty.id } })).map(reciept => reciept.userId);
					const mentionedIds = extractUserIdsFromMentions(interaction.options.getString("hunters"), []);
					const completerIdsWithoutReciept = [];
					for (const id of mentionedIds) {
						if (!allCompleterIds.includes(id)) {
							allCompleterIds.push(id);
							completerIdsWithoutReciept.push(id);
						}
					}

					const validatedCompleterIds = [];
					const completerMembers = allCompleterIds.length > 0 ? (await interaction.guild.members.fetch({ user: allCompleterIds })).values() : [];
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
						interaction.reply({ content: "There aren't any eligible bounty hunters to credit with completing this bounty. If you'd like to close your bounty without crediting anyone, use `/bounty take-down`.", ephemeral: true })
						return;
					}

					season.increment("bountiesCompleted");

					bounty.state = "completed";
					bounty.completedAt = new Date();
					bounty.save();

					const rawCompletions = [];
					for (const userId of completerIdsWithoutReciept) {
						rawCompletions.push({
							bountyId: bounty.id,
							userId,
							companyId: interaction.guildId
						});
					}
					await database.models.Completion.bulkCreate(rawCompletions);
					database.models.Completion.update({ xpAwarded: bountyValue }, { where: { bountyId: bounty.id } });

					for (const userId of validatedCompleterIds) {
						const hunter = await database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId } });
						const completerLevelTexts = await hunter.addXP(interaction.guild.name, bountyValue, true, database);
						if (completerLevelTexts.length > 0) {
							levelTexts = levelTexts.concat(completerLevelTexts);
						}
						hunter.othersFinished++;
						hunter.save();
					}

					const posterXP = Math.ceil(validatedCompleterIds.length / 2) * company.eventMultiplier;
					const posterLevelTexts = await poster.addXP(interaction.guild.name, posterXP, true, database);
					if (posterLevelTexts.length > 0) {
						levelTexts = levelTexts.concat(posterLevelTexts);
					}
					poster.mineFinished++;
					poster.save();

					getRankUpdates(interaction.guild, database).then(rankUpdates => {
						const multiplierString = company.festivalMultiplierString();
						let text = `__**XP Gained**__\n${validatedCompleterIds.map(id => `<@${id}> + ${bountyValue} XP${multiplierString}`).join("\n")}\n${interaction.member} + ${posterXP} XP${multiplierString}`;
						if (rankUpdates.length > 0) {
							text += `\n\n__**Rank Ups**__\n- ${rankUpdates.join("\n- ")}`;
						}
						if (levelTexts.length > 0) {
							text += `\n\n__**Rewards**__\n- ${levelTexts.join("\n- ")}`;
						}
						if (text.length > MAX_MESSAGE_CONTENT_LENGTH) {
							text = "Message overflow! Many people (?) probably gained many things (?). Use `/stats` to look things up.";
						}

						bounty.asEmbed(interaction.guild, poster.level, company.festivalMultiplierString(), database).then(embed => {
							const replyPayload = { embeds: [embed] };

							if (company.bountyBoardId) {
								interaction.guild.channels.fetch(company.bountyBoardId).then(bountyBoard => {
									bountyBoard.threads.fetch(bounty.postingId).then(thread => {
										thread.send({ content: text, flags: MessageFlags.SuppressNotifications });
									})
								})
							} else {
								replyPayload.content = text;
							}
							interaction.reply(replyPayload);
						}).then(() => {
							return bounty.updatePosting(interaction.guild, company, database);
						})

						updateScoreboard(company, interaction.guild, database);
					});
				})
				break;
			case subcommands[7].name: // take-down
				database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.user.id, state: "open" } }).then(openBounties => {
					const bountyOptions = openBounties.map(bounty => {
						return {
							emoji: getNumberEmoji(bounty.slotNumber),
							label: bounty.title,
							description: trimForSelectOptionDescription(bounty.description),
							value: bounty.id
						};
					});

					interaction.reply({
						content: "If you'd like to change the title, description, image, or time of your bounty, you can use `/bounty edit` instead.",
						components: [
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder().setCustomId("bountytakedown")
									.setPlaceholder("Select a bounty to take down...")
									.setMaxValues(1)
									.setOptions(bountyOptions)
							)
						],
						ephemeral: true
					});
				})
				break;
			case subcommands[8].name: // list
				const listUserId = interaction.options.getUser(subcommands[8].optionsInput[0].name)?.id ?? interaction.user.id;
				database.models.Bounty.findAll({ where: { userId: listUserId, companyId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] }).then(async existingBounties => {
					if (existingBounties.length < 1) {
						interaction.reply({ content: `<@${listUserId}> doesn't have any open bounties posted.`, ephemeral: true });
						return;
					}
					const hunter = await database.models.Hunter.findOne({ where: { userId: listUserId, companyId: interaction.guildId } });
					const company = await database.models.Company.findByPk(interaction.guildId);
					interaction.reply({ embeds: await Promise.all(existingBounties.map(bounty => bounty.asEmbed(interaction.guild, hunter.level, company.festivalMultiplierString(), database))), ephemeral: true });
				});
				break;
		}
	}
);
