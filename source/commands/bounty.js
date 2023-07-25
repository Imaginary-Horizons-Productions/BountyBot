const { PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');
const { getNumberEmoji } = require('../helpers');

const customId = "bounty";
const options = [];
const subcommands = [
	{
		name: "post",
		description: "Post your own bounty (+1 XP)"
	},
	{
		name: "edit",
		description: "Edit one of your bounties"
	}
];
module.exports = new CommandWrapper(customId, "Bounties are user-created objectives for other server members to complete", PermissionFlagsBits.ViewChannel, false, false, 3000, options, subcommands,
	(interaction) => {
		switch (interaction.options.getSubcommand()) {
			case subcommands[0].name: // Post
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
			case subcommands[1].name:
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
		}
	}
);
