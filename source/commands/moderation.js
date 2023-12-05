const { PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { SAFE_DELIMITER } = require('../constants');
const { buildModStatsEmbed } = require('../util/embedUtil');
const { getRankUpdates } = require('../util/scoreUtil');
const { getNumberEmoji, trimForSelectOptionDescription } = require('../util/textUtil');

const mainId = "moderation";
const options = [];
const subcommands = [
	{
		name: "user-report",
		description: "Get the BountyBot moderation stats for a user",
		optionsInput: [
			{
				type: "User",
				name: "user",
				description: "The mention of the user",
				required: true
			}
		]
	},
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
module.exports = new CommandWrapper(mainId, "BountyBot moderation tools", PermissionFlagsBits.ManageRoles, false, false, 3000, options, subcommands,
	(interaction, database, runMode) => {
		let member;
		switch (interaction.options.getSubcommand()) {
			case subcommands[0].name: // user-report
				member = interaction.options.getMember(subcommands[0].optionsInput[0].name);
				database.models.Hunter.findOne({ where: { companyId: interaction.guildId, userId: member.id } }).then((hunter) => {
					if (!hunter) {
						interaction.reply({ content: `${member} has not interacted with BountyBot on this server.`, ephemeral: true });
						return;
					}
					buildModStatsEmbed(interaction.guild, member, hunter, database).then(embed => {
						interaction.reply({ embeds: [embed], ephemeral: true });
					})
				});
				break;
			case subcommands[1].name: // take-down
				const poster = interaction.options.getUser(subcommands[1].optionsInput[0].name);
				database.models.Bounty.findAll({ where: { userId: poster.id, companyId: interaction.guildId, state: "open" } }).then(openBounties => {
					const slotOptions = openBounties.map(bounty => {
						return {
							emoji: getNumberEmoji(bounty.slotNumber),
							label: bounty.title,
							description: trimForSelectOptionDescription(bounty.description),
							value: bounty.id
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
			case subcommands[2].name: // disqualify
				member = interaction.options.getMember("bounty-hunter");
				database.models.Company.findOrCreate({ where: { id: interaction.guildId } }).then(async () => {
					const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
					await database.models.User.findOrCreate({ where: { id: member.id } });
					const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { userId: member.id, companyId: interaction.guildId, seasonId: season.id }, defaults: { isRankDisqualified: true } });
					if (!participationCreated) {
						participation.isRankDisqualified = !participation.isRankDisqualified;
						participation.save();
					}
					if (participationCreated || participation.isRankDisqualified) {
						participation.increment("dqCount");
					}
					getRankUpdates(interaction.guild, database);
					interaction.reply({ content: `<@${member.id}> has been ${participation.isRankDisqualified ? "dis" : "re"}qualified for achieving ranks this season.`, ephemeral: true });
					member.send(`You have been ${participation.isRankDisqualified ? "dis" : "re"}qualified for season ranks this season by ${interaction.member}. The reason provided was: ${interaction.options.getString("reason")}`);
				});
				break;
			case subcommands[3].name: // penalty
				member = interaction.options.getMember("bounty-hunter");
				database.models.Hunter.findOne({ where: { userId: member.id, companyId: interaction.guildId } }).then(async hunter => {
					if (!hunter) {
						interaction.reply({ content: `${member} hasn't interacted with BountyBot yet.`, ephemeral: true });
						return;
					}
					const penaltyValue = Math.abs(interaction.options.getInteger("penalty"));
					hunter.decrement({ xp: penaltyValue });
					hunter.increment({ penaltyCount: 1, penaltyPointTotal: penaltyValue });
					const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
					const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { userId: member.id, companyId: interaction.guildId, seasonId: season.id }, defaults: { xp: -1 * penaltyValue } });
					if (!participationCreated) {
						participation.decrement("xp", { by: penaltyValue });
					}
					getRankUpdates(interaction.guild, database);
					interaction.reply({ content: `<@${member.id}> has been penalized ${penaltyValue} XP.`, ephemeral: true });
					member.send(`You have been penalized ${penaltyValue} XP by ${interaction.member}. The reason provided was: ${interaction.options.getString("reason")}`);
				})
				break;
		}
	}
);
