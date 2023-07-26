const { PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');
const { getNumberEmoji, extractUserIdsFromMentions } = require('../helpers');

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
	}
];
module.exports = new CommandWrapper(customId, "Bounties are user-created objectives for other server members to complete", PermissionFlagsBits.ViewChannel, false, false, 3000, options, subcommands,
	(interaction) => {
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
								description: `Reward: ${hunter.slotWorth(slotNumber)} XP`,
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
						interaction.reply({ content: "You don't seem to have any open bounties at the moment." });
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
				database.models.Bounty.findAll({ where: { userId: interaction.user.id, guildId: interaction.guildId, state: "open" } }).then(async openBounties => {
					const slotsWithBounties = openBounties.map(bounty => bounty.slotNumber);

					if (slotsWithBounties.length < 1) {
						interaction.reply({ content: "You don't seem to have any open bounties at the moment." });
						return;
					}

					const slotNumber = interaction.options.getInteger("bounty-slot");
					if (!slotsWithBounties.includes(slotNumber)) {
						interaction.reply({ content: "You don't have a bounty in the `bounty-slot` provided.", ephemeral: true });
						return;
					}

					const completerIds = extractUserIdsFromMentions(interaction.options.getString("hunters"), [interaction.user.id]);
					const validatedCompleterIds = [];
					const bounty = openBounties.find(bounty => bounty.slotNumber == slotNumber);
					if (completerIds.length < 1) {
						interaction.reply({ content: "Could not find any user mentions in `hunters` (you can't add yourself).", ephemeral: true });
						return;
					} else {
						const completerMembers = (await interaction.guild.members.fetch({ user: completerIds })).values();
						const existingCompletions = await database.models.Completion.findAll({ where: { bountyId: bounty.id, guildId: interaction.guildId } });
						const existingCompleterIds = existingCompletions.map(completion => completion.userId);
						for (const member of completerMembers) {
							if (!existingCompleterIds.includes(member.id) && !member.user.bot) {
								validatedCompleterIds.push(member.id);
							}
						}

						if (validatedCompleterIds.length < 1) {
							interaction.reply({ content: "Could not find any new non-bot mentions in `hunters`.", ephemeral: true });
							return;
						}
					}

					const rawCompletions = [];
					for (const userId of validatedCompleterIds) {
						const [user] = await database.models.User.findOrCreate({ where: { id: userId } });
						rawCompletions.push({
							bountyId: bounty.id,
							userId,
							guildId: interaction.guildId
						})
					}
					database.models.Completion.bulkCreate(rawCompletions);
					const guildProfile = await database.models.Guild.findByPk(interaction.guildId);
					if (guildProfile.bountyBoardId) {
						const poster = await database.models.Hunter.findOne({ where: { userId: interaction.user.id, guildId: interaction.guildId } });
						interaction.guild.channels.fetch(guildProfile.bountyBoardId).then(bountyBoard => {
							return bountyBoard.threads.fetch(bounty.postingId);
						}).then(thread => {
							return thread.fetchStarterMessage();
						}).then(posting => {
							bounty.asEmbed(interaction.guild, poster, guildProfile).then(embed => {
								posting.edit({ embeds: [embed] })
							})
						})
					}

					interaction.reply({
						content: `The following bounty hunters have been added as completers to **${bounty.title}**: <@${validatedCompleterIds.join(">, ")}>\n\nThey will recieve the reward XP when you \`/bounty complete\`.`,
						ephemeral: true
					});
				})
				break;
		}
	}
);
