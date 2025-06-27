const { PermissionFlagsBits, SortOrderType, ForumLayoutType, ChannelType, OverwriteType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { createEvergreenBountyThread, buildBountyEmbed } = require("../../shared");
const { SAFE_DELIMITER } = require("../../../constants");
const { timeConversion } = require("../../../shared");
const { Company } = require("../../../database/models");

module.exports = new SubcommandWrapper("bounty-board-forum", "Create a new bounty board forum channel sibling to this channel",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
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

		origin.company.bountyBoardId = bountyBoard.id;
		const [{ id: openTagId }, { id: completedTagId }] = bountyBoard.availableTags;
		origin.company.bountyBoardOpenTagId = openTagId;
		origin.company.bountyBoardCompletedTagId = completedTagId;

		const evergreenBounties = [];
		logicLayer.bounties.findCompanyBountiesByCreationDate(interaction.guildId).then(async bounties => {
			const hunterMap = await logicLayer.hunters.getCompanyHunterMap(origin.company.id);
			for (const bounty of bounties) {
				if (bounty.isEvergreen) {
					evergreenBounties.unshift(bounty);
					continue;
				}
				buildBountyEmbed(bounty, interaction.guild, bounty.userId == interaction.client.user.id ? Company.getLevel(origin.company.getXP(hunterMap)) : hunterMap.get(bounty.userId).getLevel(origin.company.xpCoefficient), false, origin.company, await logicLayer.bounties.getHunterIdSet(bounty.id)).then(bountyEmbed => {
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
				const companyLevel = Company.getLevel(origin.company.getXP(hunterMap));
				Promise.all(evergreenBounties.map(async bounty => buildBountyEmbed(bounty, interaction.guild, companyLevel, false, origin.company, await logicLayer.bounties.getHunterIdSet(bounty.id)))).then(embeds => {
					createEvergreenBountyThread(bountyBoard.threads, embeds, origin.company);
				})
			}
		});

		origin.company.save();
		interaction.reply({ content: `A new bounty board has been created: ${bountyBoard}`, flags: MessageFlags.Ephemeral });
	}
);
