const { PermissionFlagsBits, SortOrderType, ForumLayoutType, ChannelType, OverwriteType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { generateBountyBoardThread } = require("../../util/scoreUtil");
const { SAFE_DELIMITER } = require("../../constants");
const { timeConversion } = require("../../util/textUtil");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("bounty-board-forum", "Create a new bounty board forum channel sibling to this channel",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, company]) {
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
		logicLayer.bounties.findCompanyBountiesByCreationDate(interaction.guildId).then(async bounties => {
			const allHunters = await logicLayer.hunters.findCompanyHunters(bounty.companyId);
			for (const bounty of bounties) {
				if (bounty.isEvergreen) {
					evergreenBounties.unshift(bounty);
					continue;
				}
				const poster = allHunters.find(hunter => hunter.userId === bounty.userId);
				bounty.embed(interaction.guild, bounty.userId == interaction.client.user.id ? company.getLevel(allHunters) : poster.getLevel(company.xpCoefficient), false, company, await logicLayer.bounties.findBountyCompletions(bounty.id)).then(bountyEmbed => {
					return bountyBoard.threads.create({
						name: bounty.title,
						message: {
							embeds: [bountyEmbed],
							components: [new ActionRowBuilder().addComponents(
								new ButtonBuilder().setCustomId(`bbcomplete${SAFE_DELIMITER}${bounty.id}`)
									.setStyle(ButtonStyle.Success)
									.setLabel("Complete")
									.setDisabled(new Date() < new Date(new Date(bounty.createdAt) + timeConversion(5, "m", "ms"))),
								new ButtonBuilder().setCustomId(`bbaddcompleters${SAFE_DELIMITER}${bounty.id}`)
									.setStyle(ButtonStyle.Primary)
									.setLabel("Credit Hunters"),
								new ButtonBuilder().setCustomId(`bbremovecompleters${SAFE_DELIMITER}${bounty.id}`)
									.setStyle(ButtonStyle.Secondary)
									.setLabel("Uncredit Hunters"),
								new ButtonBuilder().setCustomId(`bbshowcase${SAFE_DELIMITER}${bounty.id}`)
									.setStyle(ButtonStyle.Primary)
									.setLabel("Showcase this Bounty"),
								new ButtonBuilder().setCustomId(`bbtakedown${SAFE_DELIMITER}${bounty.id}`)
									.setStyle(ButtonStyle.Danger)
									.setLabel("Take Down")
							)]
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
				Promise.all(evergreenBounties.map(async bounty => bounty.embed(interaction.guild, company.getLevel(allHunters), false, company, await logicLayer.bounties.findBountyCompletions(bounty.id)))).then(embeds => {
					generateBountyBoardThread(bountyBoard.threads, embeds, company);
				})
			}
		});

		company.save();
		interaction.reply({ content: `A new bounty board has been created: ${bountyBoard}`, flags: [MessageFlags.Ephemeral] });
	}
);
