const { PermissionFlagsBits, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');
const { SAFE_DELIMITER } = require('../constants');
const { getNumberEmoji, extractUserIdsFromMentions, getRankUpdates } = require('../helpers');
const { Bounty } = require('../models/bounties/Bounty');

const customId = "evergreen";
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
];
//TODONOW remove
//TODO swap
//TODO showcase
module.exports = new CommandWrapper(customId, "Evergreen Bounties are not closed after completion; ideal for server-wide objectives", PermissionFlagsBits.ManageChannels, true, false, 3000, options, subcommands,
	(interaction) => {
		let slotNumber;
		switch (interaction.options.getSubcommand()) {
			case subcommands[0].name: // post
				database.models.Bounty.findAll({ where: { userId: interaction.client.user.id, guildId: interaction.guildId, state: "open" } }).then(existingBounties => {
					if (existingBounties.length > 9) {
						interaction.reply({ content: "Each server can only have 10 Evergreen Bounties.", ephemeral: true });
						return;
					}

					const slotNumber = existingBounties.length + 1;
					interaction.showModal(
						new ModalBuilder().setCustomId(`evergreenpost${SAFE_DELIMITER}${slotNumber}`)
							.setTitle("New Evergreen Bounty")
							.addComponents(
								new ActionRowBuilder().addComponents(
									new TextInputBuilder().setCustomId("title")
										.setLabel("Title")
										.setStyle(TextInputStyle.Short)
										.setPlaceholder("Discord markdown allowed...")
										.setMaxLength(256)
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
				});
				break;
			case subcommands[1].name:
				database.models.Bounty.findAll({ where: { userId: interaction.client.user.id, guildId: interaction.guildId, state: "open" } }).then(openBounties => {
					const slotOptions = openBounties.map(bounty => {
						return {
							emoji: getNumberEmoji(bounty.slotNumber),
							label: bounty.title,
							description: bounty.description,
							value: bounty.slotNumber.toString()
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
								new StringSelectMenuBuilder().setCustomId("evergreeneditselect")
									.setPlaceholder("Select a bounty to edit...")
									.setMaxValues(1)
									.setOptions(slotOptions)
							)
						],
						ephemeral: true
					});
				})
				break;
			case subcommands[2].name: //complete
				slotNumber = interaction.options.getInteger("bounty-slot");
				database.models.Bounty.findOne({ where: { userId: interaction.client.user.id, guildId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
					if (!bounty) {
						interaction.reply({ content: "There isn't an evergreen bounty in the `bounty-slot` provided.", ephemeral: true });
						return;
					}

					const guildProfile = await database.models.Guild.findByPk(interaction.guildId);

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
						interaction.reply({ content: "There aren't any eligible bounty hunters to credit with completing this evergreen bounty.", ephemeral: true })
						return;
					}

					guildProfile.increment("seasonBounties");

					const rawCompletions = [];
					for (const userId of dedupedCompleterIds) {
						rawCompletions.push({
							bountyId: bounty.id,
							userId,
							guildId: interaction.guildId
						});
					}
					await database.models.Completion.bulkCreate(rawCompletions);

					const bountyValue = Bounty.slotWorth(guildProfile.level, slotNumber) * guildProfile.eventMultiplier;
					database.models.Completion.update({ xpAwarded: bountyValue }, { where: { bountyId: bounty.id } });

					for (const userId of validatedCompleterIds) {
						const hunter = await database.models.Hunter.findOne({ where: { guildId: interaction.guildId, userId } });
						levelTexts.concat(await hunter.addXP(interaction.guild, bountyValue, true));
						hunter.othersFinished++;
						hunter.save();
					}

					bounty.asEmbed(interaction.guild, guildProfile.level, guildProfile.eventMultiplierString()).then(embed => { //TODO #51 `/bounty complete` crashes on uncaught error if used without bounty board forum channel
						return interaction.reply({ embeds: [embed], fetchReply: true });
					}).then(replyMessage => {
						getRankUpdates(interaction.guild).then(rankUpdates => {
							replyMessage.startThread({ name: "Rewards" }).then(thread => {
								const multiplierString = guildProfile.eventMultiplierString();
								let text = "";
								if (rankUpdates.length > 0) {
									text += `\n__**Rank Ups**__\n${rankUpdates.join("\n")}\n`;
								}
								text += `__**XP Gained**__\n${validatedCompleterIds.map(id => `<@${id}> + ${bountyValue} XP${multiplierString}`).join("\n")}\n`;
								if (levelTexts.length > 0) {
									text += `\n__**Rewards**__\n${levelTexts.filter(text => Boolean(text)).join("\n")}`;
								}
								if (text.length > 2000) {
									text = "Message overflow! Many people (?) probably gained many things (?). Use `/stats` to look things up.";
								}
								thread.send(text);
							})
						});
					})
				})
				break;
		}
	}
);
