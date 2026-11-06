import { ChannelType, ForumLayoutType, MessageFlags, OverwriteType, PermissionFlagsBits, SlashCommandStringOption, SortOrderType } from "discord.js";
import { DatabaseTypes } from "../../../database/index.ts";
import { isNotNull } from "../../../shared/types.ts";
import { SubcommandFunctionality } from "../../classes/index.ts";
import { bountyControlPanelSelectRow, bountyEmbed, isMissingPermissionError, makeEvergreenBountiesThread } from "../../shared/index.ts";

const channelNameOption = new SlashCommandStringOption().setName("channel-name")
	.setDescription("The name for the bounty board forum");

export default new SubcommandFunctionality("bounty-board-forum", "Create a new bounty board forum channel sibling to this channel",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		if (interaction.channel === null) {
			return;
		}
		const customChannelName = interaction.options.getString(channelNameOption.name);

		const bountyBoard = await interaction.guild.channels.create({
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
			defaultReactionEmoji: { id: null, name: "👀" },
			defaultSortOrder: SortOrderType.CreationDate,
			defaultForumLayout: ForumLayoutType.ListView,
			reason: `/create-default bounty-board-forum by ${interaction.user}`
		}).catch(error => {
			if (isMissingPermissionError(error)) {
				interaction.reply({ content: "Could not create a Bounty Board Forum because BountyBot appears to be missing the `ManageChannels` permission.", flags: MessageFlags.Ephemeral });
			} else {
				console.error(error);
			}
		});
		if (!bountyBoard) {
			return;
		}

		const [{ id: openTagId }, { id: completedTagId }] = bountyBoard.availableTags;
		theater.company.update({
			bountyBoardId: bountyBoard.id,
			bountyBoardOpenTagId: openTagId,
			bountyBoardCompletedTagId: completedTagId
		});

		const evergreenBounties: DatabaseTypes.Bounty[] = [];
		logicLayer.bounties.findCompanyBountiesByCreationDate(interaction.guildId).then(async bounties => {
			const hunterMap = await logicLayer.hunters.getCompanyHunterMap(theater.company.id);
			for (const bounty of bounties) {
				if (bounty.isEvergreen) {
					evergreenBounties.unshift(bounty);
					continue;
				}

				const hunter = hunterMap.get(bounty.userId);
				if (hunter === undefined) {
					continue;
				}
				bountyBoard.threads.create({
					name: bounty.title,
					message: {
						embeds: [bountyEmbed(bounty, bounty.userId === interaction.member.id ? interaction.member : await interaction.guild.members.fetch(bounty.userId), hunter.getLevel(theater.company.xpCoefficient), false, theater.company, await logicLayer.bounties.getHunterIdSet(bounty.id), await bounty.getScheduledEvent(interaction.guild.scheduledEvents))],
						components: bountyControlPanelSelectRow(bounty.id)
					},
					appliedTags: [openTagId]
				}).then(posting => {
					bounty.update({ postingId: posting.id });
				})
			}

			// make Evergreen Bounty list
			if (evergreenBounties.length > 0 && isNotNull(interaction.guild.members.me)) {
				const companyLevel = DatabaseTypes.Company.getLevel(theater.company.getXP(hunterMap));
				const embeds = [];
				for (const bounty of evergreenBounties) {
					embeds.push(bountyEmbed(bounty, interaction.guild.members.me, companyLevel, false, theater.company, await logicLayer.bounties.getHunterIdSet(bounty.id)));
				}
				makeEvergreenBountiesThread(bountyBoard.threads, embeds, theater.company);
			}
		});

		interaction.reply({ content: `A new bounty board has been created: ${bountyBoard}`, flags: MessageFlags.Ephemeral });
	}
).setOptions(channelNameOption);
