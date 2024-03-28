const { CommandInteraction, PermissionFlagsBits, SortOrderType, ForumLayoutType, ChannelType, OverwriteType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { Sequelize } = require("sequelize");
const { generateBountyBoardThread } = require("../../util/scoreUtil");
const { Company } = require("../../models/companies/Company");
const { SAFE_DELIMITER } = require("../../constants");
const { timeConversion } = require("../../util/textUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[Company]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[company]) {
	const bountyBoard = await interaction.guild.channels.create({
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
		availableTags: [{ name: "Open", moderated: true }, { name: "Completed", moderated: true }],
		defaultReactionEmoji: { name: "👀" },
		defaultSortOrder: SortOrderType.CreationDate,
		defaultForumLayout: ForumLayoutType.ListView,
		reason: `/create-default bounty-board-forum by ${interaction.user}`
	});

	company.bountyBoardId = bountyBoard.id;
	const [{ id: openTagId }, { id: completedTagId }] = bountyBoard.availableTags;
	company.bountyBoardOpenTagId = openTagId;
	company.bountyBoardCompletedTagId = completedTagId;

	const evergreenBounties = [];
	database.models.Bounty.findAll({ where: { companyId: interaction.guildId, state: "open" }, order: [["createdAt", "DESC"]] }).then(bounties => {
		for (const bounty of bounties) {
			if (bounty.isEvergreen) {
				evergreenBounties.unshift(bounty);
				continue;
			}
			database.models.Hunter.findOne({ companyId: bounty.guildId, userId: bounty.userId }).then(poster => {
				return bounty.asEmbed(interaction.guild, bounty.userId == interaction.client.user.id ? company.level : poster.level, company.festivalMultiplierString(), false, database);
			}).then(bountyEmbed => {
				return bountyBoard.threads.create({
					name: bounty.title,
					message: {
						embeds: [bountyEmbed],
						components: new ActionRowBuilder().addComponents(
							new ButtonBuilder().setCustomId(`bbcomplete${SAFE_DELIMITER}${bounty.id}`)
								.setStyle(ButtonStyle.Success)
								.setLabel("Complete")
								.setDisabled(new Date() < new Date(new Date(bounty.createdAt) + timeConversion(5, "m", "ms"))),
							new ButtonBuilder().setCustomId(`bbaddcompleters${SAFE_DELIMITER}${bounty.id}`)
								.setStyle(ButtonStyle.Primary)
								.setLabel("Credit Hunters"),
							new ButtonBuilder().setCustomId(`bbremovecompleters${SAFE_DELIMITER}${bounty.id}`)
								.setStyle(ButtonStyle.Primary)
								.setLabel("Uncredit Hunters"),
							new ButtonBuilder().setCustomId(`bbtakedown${SAFE_DELIMITER}${bounty.id}`)
								.setStyle(ButtonStyle.Danger)
								.setLabel("Take Down")
						)
					},
					appliedTags: [openTagId]
				})
			}).then(posting => {
				bounty.postingId = posting.id;
				bounty.save()
			})
		}

		// make Evergreen Bounty list
		if (evergreenBounties.length > 0) {
			Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(interaction.guild, company.level, company.festivalMultiplierString(), false, database))).then(embeds => {
				generateBountyBoardThread(bountyBoard.threads, embeds, company);
			})
		}
	});

	company.save();
	interaction.reply({ content: `A new bounty board has been created: ${bountyBoard}`, ephemeral: true });
};

module.exports = {
	data: {
		name: "bounty-board-forum",
		description: "Create a new bounty board forum channel sibling to this channel"
	},
	executeSubcommand
};
