const { PermissionFlagsBits, ChannelType, SortOrderType, ForumLayoutType, OverwriteType, GuildPremiumTier } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');
const { buildSeasonalScoreboardEmbed, buildOverallScoreboardEmbed } = require('../embedHelpers');
const { generateBountyBoardThread } = require('../helpers');

const mainId = "create-default";
const options = [];
const subcommands = [
	{
		name: "bounty-board-forum",
		description: "Create a new bounty board forum channel sibling to this channel"
	},
	{
		name: "scoreboard-reference",
		description: "Create a reference channel with the BountyBot Scoreboard",
		optionsInput: [
			{
				type: "String",
				name: "scoreboard-type",
				description: "Pick if the scoreboard will show season XP or overall XP, only one updates",
				required: true,
				choices: [
					{ name: "Season Scoreboard", value: "season" },
					{ name: "Overall Scoreboard", value: "overall" }
				]
			}
		]
	},
	{
		name: "rank-roles",
		description: "Create Discord roles and set them as this server's ranks at default variance thresholds"
	}
];
module.exports = new CommandWrapper(mainId, "Create a Discord resource for use by BountyBot", PermissionFlagsBits.ManageChannels, false, false, 30000, options, subcommands,
	(interaction) => {
		switch (interaction.options.getSubcommand()) {
			case subcommands[0].name: // bounty-board-forum
				interaction.guild.channels.create({
					parent: interaction.channel.parentId,
					name: "the-bounty-board",
					type: ChannelType.GuildForum,
					permissionOverwrites: [
						{
							id: interaction.client.user,
							allow: [PermissionFlagsBits.SendMessages],
							type: OverwriteType.Member
						},
						{
							id: interaction.guildId,
							deny: [PermissionFlagsBits.SendMessages],
							allow: [PermissionFlagsBits.SendMessagesInThreads]
						}
					],
					//TODO #77 use "availableTags" to allow tagging bounties ("completed", "event", "open" as default tags?)
					defaultSortOrder: SortOrderType.CreationDate,
					defaultForumLayout: ForumLayoutType.ListView,
					reason: `/create-default bounty-board-forum by ${interaction.user}`
				}).then(async bountyBoard => {
					const [company] = await database.models.Company.findOrCreate({ where: { id: interaction.guildId } });

					company.bountyBoardId = bountyBoard.id;

					const evergreenBounties = [];
					database.models.Bounty.findAll({ where: { companyId: interaction.guildId, state: "open" }, order: [["createdAt", "DESC"]] }).then(bounties => {
						for (const bounty of bounties) {
							if (bounty.isEvergreen) {
								evergreenBounties.unshift(bounty);
								continue;
							}
							database.models.Hunter.findOne({ companyId: bounty.guildId, userId: bounty.userId }).then(poster => {
								return bounty.asEmbed(interaction.guild, bounty.userId == interaction.client.user.id ? company.level : poster.level, company.eventMultiplierString());
							}).then(bountyEmbed => {
								return bountyBoard.threads.create({
									name: bounty.title,
									message: { embeds: [bountyEmbed] }
								})
							}).then(posting => {
								bounty.postingId = posting.id;
								bounty.save()
							})
						}

						// make Evergreen Bounty list
						if (evergreenBounties.length > 0) {
							Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(interaction.guild, company.level, company.eventMultiplierString()))).then(embeds => {
								generateBountyBoardThread(bountyBoard.threads, embeds, company);
							})
						}
					});

					company.save();
					interaction.reply({ content: `A new bounty board has been created: ${bountyBoard}`, ephemeral: true });
				});
				break;
			case subcommands[1].name: // scoreboard-reference
				interaction.guild.channels.create({
					parent: interaction.channel.parentId,
					name: "bountybot-scoreboard",
					type: ChannelType.GuildText,
					permissionOverwrites: [
						{
							id: interaction.client.user,
							allow: [PermissionFlagsBits.SendMessages],
							type: OverwriteType.Member
						},
						{
							id: interaction.guildId,
							deny: [PermissionFlagsBits.SendMessages]
						}
					],
					reason: `/create-default scoreboard-reference by ${interaction.user}`
				}).then(async scoreboard => {
					const [company] = await database.models.Company.findOrCreate({ where: { id: interaction.guildId } });
					const isSeasonal = interaction.options.getString("scoreboard-type") == "season";
					scoreboard.send({
						embeds: [isSeasonal ? await buildSeasonalScoreboardEmbed(interaction.guild) : await buildOverallScoreboardEmbed(interaction.guild)]
					}).then(message => {
						company.scoreboardChannelId = scoreboard.id;
						company.scoreboardMessageId = message.id;
						company.scoreboardIsSeasonal = isSeasonal;
						company.save();
					});
					interaction.reply({ content: `A new scoreboard reference channel has been created: ${scoreboard}`, ephemeral: true });
				})
				break;
			case subcommands[2].name: // rank-roles
				interaction.guild.roles.fetch().then(existingGuildRoles => {
					return Promise.all(
						[
							{
								name: "Platinum Rank",
								color: "#669999",
								icon: "./source/images/BountyBotIcon.jpg",
								reason: "/create-default rank-roles"
							},
							{
								name: "Gold Rank",
								color: "#daa520",
								icon: "./source/images/BountyBotIcon.jpg",
								reason: "/create-default rank-roles"
							},
							{
								name: "Silver Rank",
								color: "#ccccff",
								icon: "./source/images/BountyBotIcon.jpg",
								reason: "/create-default rank-roles"
							},
							{
								name: "Bronze Rank",
								color: "#b9722d",
								icon: "./source/images/BountyBotIcon.jpg",
								reason: "/create-default rank-roles"
							}
						].map((roleCreateOptions, index) => {
							if (interaction.guild.premiumTier < GuildPremiumTier.Tier2) {
								delete roleCreateOptions.icon;
							}
							roleCreateOptions.position = existingGuildRoles.length + index;
							return interaction.guild.roles.create(roleCreateOptions);
						})
					)
				}).then((roles) => {
					const varianceThresholds = [2.5, 1, 0, -3];
					const rankmojis = ["🏆", "🥇", "🥈", "🥉"];

					database.models.Company.findOrCreate({ where: { id: interaction.guildId } }).then(() => {
						database.models.CompanyRank.bulkCreate(roles.map((role, index) => ({
							companyId: interaction.guildId,
							varianceThreshold: varianceThresholds[index],
							roleId: role.id,
							rankmoji: rankmojis[index]
						})));
					});
					interaction.reply({ content: `Created roles: ${roles.map((role, index) => `${rankmojis[index]} ${role} at ${varianceThresholds[index]} standard deviations`).join(", ")}`, ephemeral: true });
				})
				break;
		}
	}
);
