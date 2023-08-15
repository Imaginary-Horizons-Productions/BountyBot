const { PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');
const { getNumberEmoji, getRankUpdates } = require('../helpers');
const { SAFE_DELIMITER } = require('../constants');

const customId = "moderation";
const options = [];
const subcommands = [
	{
		name: "take-down",
		description: "Take down another user's bounty",
		optionsInput: [
			{
				type: "User",
				name: "poster",
				description: "The mention of the poster of the bounty",
				required: true
			}
		]
	},
	{
		name: "season-disqualify",
		description: "Toggle disqualification from ranking for a bounty hunter in the current season",
		optionsInput: [
			{
				type: "User",
				name: "bounty-hunter",
				description: "The mention of the hunter to disqualify/requalify",
				required: true
			},
			{
				type: "String",
				name: "reason",
				description: "The reason for the disqualification",
				required: true
			}
		]
	},
	{
		name: "xp-penalty",
		description: "Reduce a bounty hunter's XP",
		optionsInput: [
			{
				type: "User",
				name: "bounty-hunter",
				description: "The bounty hunter to remove XP from",
				required: true
			},
			{
				type: "Integer",
				name: "penalty",
				description: "The amount of XP to remove",
				required: true
			},
			{
				type: "String",
				name: "reason",
				description: "The reason for the penalty",
				required: true
			}
		]
	}
];
module.exports = new CommandWrapper(customId, "BountyBot moderation tools", PermissionFlagsBits.ManageRoles, false, false, 3000, options, subcommands,
	(interaction) => {
		let member;
		switch (interaction.options.getSubcommand()) {
			case subcommands[0].name: // take-down
				const poster = interaction.options.getUser(subcommands[0].optionsInput[0].name);
				database.models.Bounty.findAll({ where: { userId: poster.id, guildId: interaction.guildId, state: "open" } }).then(openBounties => {
					const slotOptions = openBounties.map(bounty => {
						return {
							emoji: getNumberEmoji(bounty.slotNumber),
							label: bounty.title,
							description: bounty.description,
							value: bounty.slotNumber.toString()
						};
					});

					if (slotOptions.length < 1) {
						interaction.reply({ content: `${poster} doesn't seem to have any open bounties at the moment.`, ephemeral: true });
						return;
					}

					interaction.reply({
						content: "The poster will also lose the XP they gained for posting the removed bounty.",
						components: [
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder().setCustomId(`modtakedown${SAFE_DELIMITER}${poster.id}`)
									.setPlaceholder("Select a bounty to take down...")
									.setMaxValues(1)
									.setOptions(slotOptions)
							)
						],
						ephemeral: true
					});
				});
				break;
			case subcommands[1].name: // disqualify
				member = interaction.options.getMember("bounty-hunter");
				database.models.Hunter.findOrCreate({ where: { userId: member.id, guildId: interaction.guildId }, defaults: { isRankEligible: member.manageable, User: { id: member.id }, Guild: { id: interaction.guildId } }, include: [database.models.Hunter.User, database.models.Hunter.Guild] }).then(([hunter]) => {
					hunter.isRankDisqualified = !hunter.isRankDisqualified;
					if (hunter.isRankDisqualified) {
						hunter.increment("seasonDQCount");
					}
					hunter.save();
					getRankUpdates(interaction.guild);
					interaction.reply({ content: `<@${member.id}> has been ${hunter.isRankDisqualified ? "dis" : "re"}qualified for achieving ranks this season.`, ephemeral: true });
					member.send(`You have been ${hunter.isRankDisqualified ? "dis" : "re"}qualified for season ranks this season by ${interaction.member}. The reason provided was: ${interaction.options.getString("reason")}`);
				})
				break;
			case subcommands[2].name: // penalty
				member = interaction.options.getMember("bounty-hunter");
				database.models.Hunter.findOne({ where: { userId: member.id, guildId: interaction.guildId } }).then(async hunter => {
					if (!hunter) {
						interaction.reply({ content: `${member} hasn't interacted with BountyBot yet.`, ephemeral: true });
						return;
					}
					const penaltyValue = Math.abs(interaction.options.getInteger("penalty"));
					const guildProfile = await database.models.Guild.findByPk(interaction.guildId);
					guildProfile.decrement({ seasonXP: penaltyValue });
					guildProfile.save();
					hunter.decrement(["xp", "seasonXP"], { by: penaltyValue });
					hunter.increment({ penaltyCount: 1, penaltyPointTotal: penaltyValue });
					getRankUpdates(interaction.guild);
					interaction.reply({ content: `<@${member.id}> has been penalized ${penaltyValue} XP.`, ephemeral: true });
					member.send(`You have been penalized ${penaltyValue} XP by ${interaction.member}. The reason provided was: ${interaction.options.getString("reason")}`);
				})
				break;
		}
	}
);
