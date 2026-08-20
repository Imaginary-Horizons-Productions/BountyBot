import { ChannelType, type ForumChannel, ForumLayoutType, MessageFlags, OverwriteType, PermissionFlagsBits, SlashCommandStringOption, SortOrderType } from "discord.js";
import { DatabaseTypes } from "../../../database";
import { SubcommandFunctionality } from "../../classes";
import { bountyControlPanelSelectRow, bountyEmbed, isMissingPermissionError, makeEvergreenBountiesThread } from "../../shared";

const channelNameOption = new SlashCommandStringOption().setName("channel-name")
	.setDescription("The name for the bounty board forum");

export default new SubcommandFunctionality("bounty-board-forum", "Create a new bounty board forum channel sibling to this channel",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		const customChannelName = interaction.options.getString(channelNameOption.name);

		let bountyBoard: ForumChannel;
		try {
			bountyBoard = await interaction.guild.channels.create({
				parent: interaction.channel.parentId,
				name: customChannelName ?? "the-bounty-board",
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
		} catch (error) {
			if (isMissingPermissionError(error)) {
				interaction.reply({ content: "Could not create a Bounty Board Forum because BountyBot appears to be missing the `ManageChannels` permission.", flags: MessageFlags.Ephemeral });
				return;
			} else {
				console.error(error);
			}
		}

		theater.company.bountyBoardId = bountyBoard.id;
		const [{ id: openTagId }, { id: completedTagId }] = bountyBoard.availableTags;
		theater.company.bountyBoardOpenTagId = openTagId;
		theater.company.bountyBoardCompletedTagId = completedTagId;

		const evergreenBounties: DatabaseTypes.Bounty[] = [];
		logicLayer.bounties.findCompanyBountiesByCreationDate(interaction.guildId).then(async bounties => {
			const hunterMap = await logicLayer.hunters.getCompanyHunterMap(theater.company.id);
			for (const bounty of bounties) {
				if (bounty.isEvergreen) {
					evergreenBounties.unshift(bounty);
					continue;
				}

				bountyBoard.threads.create({
					name: bounty.title,
					message: {
						embeds: [bountyEmbed(bounty, bounty.userId === interaction.member.id ? interaction.member : await interaction.guild.members.fetch(bounty.userId), hunterMap.get(bounty.userId).getLevel(theater.company.xpCoefficient), false, theater.company, await logicLayer.bounties.getHunterIdSet(bounty.id), await bounty.getScheduledEvent(interaction.guild.scheduledEvents))],
						components: bountyControlPanelSelectRow(bounty.id)
					},
					appliedTags: [openTagId]
				}).then(posting => {
					bounty.update({ postingId: posting.id });
				})
			}

			// make Evergreen Bounty list
			if (evergreenBounties.length > 0) {
				const companyLevel = DatabaseTypes.Company.getLevel(theater.company.getXP(hunterMap));
				Promise.all(evergreenBounties.map(async bounty => bountyEmbed(bounty, interaction.guild.members.me, companyLevel, false, theater.company, await logicLayer.bounties.getHunterIdSet(bounty.id)))).then(embeds => {
					makeEvergreenBountiesThread(bountyBoard.threads, embeds, theater.company);
				})
			}
		});

		theater.company.save();
		interaction.reply({ content: `A new bounty board has been created: ${bountyBoard}`, flags: MessageFlags.Ephemeral });
	}
).setOptions(channelNameOption);
