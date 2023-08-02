const { PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');
const { getNumberEmoji, extractUserIdsFromMentions, getRankUpdates } = require('../helpers');
const { Op } = require('sequelize');
const { Bounty } = require('../models/bounties/Bounty');

const customId = "bounty";
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
	}
];
module.exports = new CommandWrapper(customId, "Bounties are user-created objectives for other server members to complete", PermissionFlagsBits.ViewChannel, false, false, 3000, options, subcommands,
	(interaction) => {
		let slotNumber;
		switch (interaction.options.getSubcommand()) {
			case subcommands[0].name: // post
				database.models.Guild.findOrCreate({ where: { id: interaction.guildId } }).then(async ([{ maxSimBounties }]) => {
					const [user] = await database.models.User.findOrCreate({ where: { id: interaction.user.id } });
					const [hunter] = await database.models.Hunter.findOrCreate({ where: { userId: interaction.user.id, guildId: interaction.guildId }, defaults: { isRankEligible: interaction.member.manageable } });
					const existingBounties = await database.models.Bounty.findAll({ where: { userId: interaction.user.id, guildId: interaction.guildId, state: "open" } });
					const occupiedSlots = existingBounties.map(bounty => bounty.slotNumber);
					const bountySlots = hunter.maxSlots(maxSimBounties);
					const slotOptions = [];
					for (let slotNumber = 1; slotNumber <= bountySlots; slotNumber++) {
						if (!occupiedSlots.includes(slotNumber)) {
							slotOptions.push({
								emoji: getNumberEmoji(slotNumber),
								label: `Slot ${slotNumber}`,
								description: `Reward: ${Bounty.slotWorth(hunter.level, slotNumber)} XP`,
								value: slotNumber.toString()
							})
						}
					}

					if (slotOptions.length > 0) {
						interaction.reply({
							content: "You can post a bounty for other server members to help out with. Here's some examples:\n\t• __Party Up__ Get bounty hunters to join you for a game session\n\t• __WTB/WTS__ Get the word out your looking to trade\n\t• __Achievement Get__ Get help working toward an achievement\n\nTo make a bounty, you'll need:\n\t• a title\n\t• a description\nOptionally, you can also add:\n\t• a url for an image\n\t• a start and end time (to make an event to go with your bounty)\n\nKeep in mind that while you're in charge of adding completers and ending the bounty, the bounty is still subject to server rules and moderation.",
							components: [
								new ActionRowBuilder().addComponents(
									new StringSelectMenuBuilder().setCustomId("bountypostselect")
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
				database.models.Bounty.findAll({ where: { userId: interaction.user.id, guildId: interaction.guildId, state: "open" } }).then(openBounties => {
					const slotOptions = openBounties.map(bounty => {
						return {
							emoji: getNumberEmoji(bounty.slotNumber),
							label: bounty.title,
							description: bounty.description,
							value: bounty.slotNumber.toString()
						};
					});

					if (slotOptions.length < 1) {
						interaction.reply({ content: "You don't seem to have any open bounties at the moment.", ephemeral: true });
						return;
					}

					interaction.reply({
						content: "You can select one of your open bounties to edit below.\n\nKeep in mind that while you're in charge of adding completers and ending the bounty, the bounty is still subject to server rules and moderation.",
						components: [
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder().setCustomId("bountyeditselect")
									.setPlaceholder("Select a bounty to edit...")
									.setMaxValues(1)
									.setOptions(slotOptions)
							)
						],
						ephemeral: true
					});
				})
				break;
			case subcommands[2].name: // add-completers
				slotNumber = interaction.options.getInteger("bounty-slot");
				database.models.Bounty.findOne({ where: { userId: interaction.user.id, guildId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
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
					const existingCompletions = await database.models.Completion.findAll({ where: { bountyId: bounty.id, guildId: interaction.guildId } });
					const existingCompleterIds = existingCompletions.map(completion => completion.userId);
					const bannedIds = [];
					for (const member of completerMembers) {
						const memberId = member.id;
						if (!existingCompleterIds.includes(memberId)) {
							const [user] = await database.models.User.findOrCreate({ where: { id: memberId } });
							const [hunter] = await database.models.Hunter.findOrCreate({ where: { userId: memberId, guildId: interaction.guildId }, defaults: { isRankEligible: member.manageable } });
							if (hunter.isBanned) {
								bannedIds.push(memberId);
								continue;
							}
							if (!member.user.bot) {
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
							guildId: interaction.guildId
						})
					}
					database.models.Completion.bulkCreate(rawCompletions);
					const guildProfile = await database.models.Guild.findByPk(interaction.guildId);
					bounty.updatePosting(interaction.guild, guildProfile);

					interaction.reply({
						content: `The following bounty hunters have been added as completers to **${bounty.title}**: <@${validatedCompleterIds.join(">, ")}>\n\nThey will recieve the reward XP when you \`/bounty complete\`.${bannedIds.length > 0 ? `\n\nThe following users were not added, due to currently being banned from using BountyBot: <@${bannedIds.join(">, ")}>` : ""}`,
						ephemeral: true
					});
				})
				break;
			case subcommands[3].name: // remove-completers
				slotNumber = interaction.options.getInteger("bounty-slot");
				database.models.Bounty.findOne({ where: { userId: interaction.user.id, guildId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
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
					const guildProfile = await database.models.Guild.findByPk(interaction.guildId);
					bounty.updatePosting(interaction.guild, guildProfile);

					interaction.reply({ //TODO make sure acknowledging interactions is sharding safe
						content: `The following bounty hunters have been removed as completers from **${bounty.title}**: <@${mentionedIds.join(">, ")}>`,
						ephemeral: true
					});
				})
				break;
			case subcommands[4].name: // complete
				slotNumber = interaction.options.getInteger("bounty-slot");
				database.models.Bounty.findOne({ where: { userId: interaction.user.id, guildId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
					if (!bounty) {
						interaction.reply({ content: "You don't have a bounty in the `bounty-slot` provided.", ephemeral: true });
						return;
					}

					// disallow completion within 5 minutes of creating bounty
					if (bounty.createdAt < Date.now() + 300000) {
						interaction.reply({ content: "Bounties cannot be completed within 5 minutes of their posting. You can `/bounty add-completers` so you won't forget instead.", ephemeral: true });
						return;
					}

					// poster guaranteed to exist, creating a bounty gives 1 XP
					const poster = await database.models.Hunter.findOne({ where: { userId: interaction.user.id, guildId: interaction.guildId } });
					const guildProfile = await database.models.Guild.findByPk(interaction.guildId);
					const bountyValue = Bounty.slotWorth(poster.level, slotNumber) * guildProfile.eventMultiplier;

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
					const levelTexts = [];
					for (const member of completerMembers) {
						if (!member.user.bot) {
							const memberId = member.id;
							const [user] = await database.models.User.findOrCreate({ where: { id: memberId } });
							const [hunter] = await database.models.Hunter.findOrCreate({ where: { userId: memberId, guildId: interaction.guildId }, defaults: { isRankEligible: member.manageable } });
							if (!hunter.isBanned) {
								validatedCompleterIds.push(memberId);
							}
						}
					}

					if (validatedCompleterIds.length < 1) {
						interaction.reply({ content: "There aren't any eligible bounty hunters to credit with completing this bounty. If you'd like to close your bounty without crediting anyone, use `/bounty take-down`.", ephemeral: true })
						return;
					}

					guildProfile.increment("seasonBounties");

					bounty.state = "completed";
					bounty.completedAt = new Date();
					bounty.save();

					const rawCompletions = [];
					for (const userId of completerIdsWithoutReciept) {
						rawCompletions.push({
							bountyId: bounty.id,
							userId,
							guildId: interaction.guildId
						});
					}
					await database.models.Completion.bulkCreate(rawCompletions);
					database.models.Completion.update({ xpAwarded: bountyValue }, { where: { bountyId: bounty.id } });

					for (const userId of validatedCompleterIds) {
						const hunter = await database.models.Hunter.findOne({ where: { guildId: interaction.guildId, userId } });
						levelTexts.concat(await hunter.addXP(interaction.guild, bountyValue, true));
						hunter.othersFinished++;
						hunter.save();
					}

					const posterXP = Math.ceil(validatedCompleterIds.length / 2) * guildProfile.eventMultiplier;
					levelTexts.concat(await poster.addXP(interaction.guild, posterXP, true));
					poster.mineFinished++;
					poster.save();

					bounty.asEmbed(interaction.guild, poster.level, guildProfile.eventMultiplierString()).then(embed => { //TODO #51 `/bounty complete` crashes on uncaught error if used without bounty board forum channel
						interaction.reply({ embeds: [embed] });
					}).then(() => {
						return bounty.updatePosting(interaction.guild, guildProfile);
					}).then(() => {
						getRankUpdates(interaction.guild).then(rankUpdates => {
							interaction.guild.channels.fetch(guildProfile.bountyBoardId).then(bountyBoard => {
								bountyBoard.threads.fetch(bounty.postingId).then(thread => {
									const multiplierString = guildProfile.eventMultiplierString();
									let text = "";
									if (rankUpdates.length > 0) {
										text += `\n__**Rank Ups**__\n${rankUpdates.join("\n")}\n`;
									}
									text += `__**XP Gained**__\n${validatedCompleterIds.map(id => `<@${id}> + ${bountyValue} XP${multiplierString}`).join("\n")}\n${interaction.member} + ${posterXP} XP${multiplierString}\n`;
									if (levelTexts.length > 0) {
										text += `\n__**Rewards**__\n${levelTexts.filter(text => Boolean(text)).join("\n")}`;
									}
									if (text.length > 2000) {
										text = "Message overflow! Many people (?) probably gained many things (?). Use `/stats` to look things up.";
									}
									thread.send(text);
								})
							})
							//TODONOW update scoreboard
						});
					})
				})
				break;
			case subcommands[5].name: // take-down
				database.models.Bounty.findAll({ where: { guildId: interaction.guildId, userId: interaction.user.id, state: "open" } }).then(openBounties => {
					const bountyOptions = openBounties.map(bounty => {
						return {
							emoji: getNumberEmoji(bounty.slotNumber),
							label: bounty.title,
							description: bounty.description,
							value: bounty.slotNumber.toString()
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
		}
	}
);
