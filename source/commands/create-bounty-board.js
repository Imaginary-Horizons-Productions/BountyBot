const { PermissionFlagsBits, ChannelType, SortOrderType, ForumLayoutType, OverwriteType } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');
const { generateScorelines } = require('../embedHelpers');

const customId = "create-bounty-board";
const options = [];
const subcommands = [];
module.exports = new CommandWrapper(customId, "Create a new bounty board forum channel sibling to this channel", PermissionFlagsBits.ManageChannels, false, false, 30000, options, subcommands,
	/** Create a new bounty board forum channel sibling to this channel */
	(interaction) => {
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

			const scoreboardPost = await bountyBoard.threads.create({
				name: "The Scoreboard",
				message: { content: await generateScorelines(interaction.guild, true) }
			});
			scoreboardPost.pin();
			guildProfile.scoreId = scoreboardPost.id;

			database.models.Bounty.findAll({ where: { guildId: interaction.guildId, state: "open" }, order: [["createdAt", "DESC"]] }).then(bounties => {
				for (const bounty of bounties) {
					bounty.asEmbed(interaction.guild, undefined, guildProfile).then(bountyEmbed => {
						return bountyBoard.threads.create({
							name: bounty.title,
							message: { embeds: [bountyEmbed] }
						})
					}).then(posting => {
						bounty.postingId = posting.id;
						bounty.save()
					})
				}
			});

			guildProfile.save();
			interaction.reply({ content: `A new bounty board has been created: ${bountyBoard}`, ephemeral: true });
		});
	}
);
