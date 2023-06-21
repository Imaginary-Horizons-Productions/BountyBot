const { PermissionFlagsBits, ChannelType, SortOrderType, ForumLayoutType, OverwriteType } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');

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
			defaultForumLayout: ForumLayoutType.GalleryView,
			reason: `/create-bounty-board by ${interaction.user}`
		}).then(async bountyBoard => {
			let guildProfile = await database.models.Guild.findByPk(interaction.guildId);
			if (!guildProfile) {
				guildProfile = await database.models.Guild.create({ id: interaction.guildId });
			}

			guildProfile.bountyBoardId = bountyBoard.id;

			const scoreboard = await bountyBoard.threads.create({
				name: "The Scoreboard",
				message: "placeholder" //TODO generate scoreboard content
			});
			scoreboard.pin();
			guildProfile.scoreId = scoreboard.id;

			//TODO create posts for existing bounties

			guildProfile.save();
			interaction.reply({ content: `A new bounty board has been created: ${bountyBoard}`, ephemeral: true });
		});
	}
);
