const { PermissionFlagsBits, ChannelType, SortOrderType, ForumLayoutType, OverwriteType } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');
const { buildScoreboardEmbed } = require('../embedHelpers');
const { generateBountyBoardThread } = require('../helpers');

const customId = "create";
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
	}
];
module.exports = new CommandWrapper(customId, "Create a Discord resource for use by BountyBot", PermissionFlagsBits.ManageChannels, false, false, 30000, options, subcommands,
	async (interaction) => {
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
					//TODO use "availableTags" to allow tagging bounties ("completed", "event", "open" as default tags?)
					defaultSortOrder: SortOrderType.CreationDate,
					defaultForumLayout: ForumLayoutType.ListView,
					reason: `/create-bounty-board by ${interaction.user}`
				}).then(async bountyBoard => {
					let guildProfile = await database.models.Guild.findByPk(interaction.guildId);
					if (!guildProfile) {
						guildProfile = await database.models.Guild.create({ id: interaction.guildId });
					}

					guildProfile.bountyBoardId = bountyBoard.id;

					const evergreenBounties = [];
					database.models.Bounty.findAll({ where: { guildId: interaction.guildId, state: "open" }, order: [["createdAt", "DESC"]] }).then(bounties => {
						for (const bounty of bounties) {
							if (bounty.isEvergreen) {
								evergreenBounties.unshift(bounty);
								continue;
							}
							database.models.Hunter.findOne({ guildId: bounty.guildId, userId: bounty.userId }).then(poster => {
								return bounty.asEmbed(interaction.guild, bounty.userId == interaction.client.user.id ? guildProfile.level : poster.level, guildProfile.eventMultiplierString());
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
							Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(interaction.guild, guildProfile.level, guildProfile.eventMultiplierString()))).then(embeds => {
								generateBountyBoardThread(bountyBoard.threads, embeds, guildProfile);
							})
						}
					});

					guildProfile.save();
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
					reason: `/create scoreboard-reference by ${interaction.user}`
				}).then(async scoreboard => {
					const [guildProfile] = await database.models.Guild.findOrCreate({ where: { id: interaction.guildId } });
					const isSeasonal = interaction.options.getString("scoreboard-type") == "season";
					scoreboard.send({
						embeds: [await buildScoreboardEmbed(interaction.guild, isSeasonal)]
					}).then(message => {
						guildProfile.scoreboardChannelId = scoreboard.id;
						guildProfile.scoreboardMessageId = message.id;
						guildProfile.scoreboardIsSeasonal = isSeasonal;
						guildProfile.save();
					});
					interaction.reply({ content: `A new scoreboard reference channel has been created: ${scoreboard}`, ephemeral: true });
				})
				break;
		}
	}
);
