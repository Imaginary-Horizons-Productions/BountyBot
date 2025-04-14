const { userMention, bold, MessageFlags, Guild } = require("discord.js");
const { listifyEN, commandMention, congratulationBuilder } = require("../../util/textUtil.js");
const { Completion } = require("../../models/bounties/Completion.js");
const { Bounty } = require("../../models/bounties/Bounty.js");
const { Company } = require("../../models/companies/Company.js");
const { Hunter } = require("../../models/users/Hunter.js");
const { SubcommandWrapper } = require("../../classes/index.js");

/**
 * Updates the board posting for the bounty after adding the completers
 * @param {Bounty} bounty
 * @param {Company} company
 * @param {Hunter} poster
 * @param {string[]} newCompleterIds
 * @param {Completion[]} completers
 * @param {Guild} guild
 */
async function updateBoardPosting(bounty, company, poster, newCompleterIds, completers, guild) {
	let boardId = company.bountyBoardId;
	let { postingId } = bounty;
	if (!boardId || !postingId) return;
	let boardsChannel = await guild.channels.fetch(boardId);
	let post = await boardsChannel.threads.fetch(postingId);
	if (post.archived) {
		await thread.setArchived(false, "Unarchived to update posting");
	}
	post.edit({ name: bounty.title });
	let numCompleters = newCompleterIds.length;
	post.send({ content: `${listifyEN(newCompleterIds.map(id => userMention(id)))} ${numCompleters === 1 ? "has" : "have"} turned in this bounty! ${congratulationBuilder()}!` });
	let starterMessage = await post.fetchStarterMessage();
	starterMessage.edit({
		embeds: [await bounty.embed(guild, poster.level, false, company, completers)],
		components: bounty.generateBountyBoardButtons()
	});
}

module.exports = new SubcommandWrapper("verify-turn-in", "Verify up to 5 bounty hunters have turned in one of your bounties",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, posterId]) {
		const slotNumber = interaction.options.getInteger("bounty-slot");

		const bounty = await logicLayer.bounties.findBounty({ slotNumber, userId: posterId, companyId: interaction.guild.id });
		if (!bounty) {
			interaction.reply({ content: "You don't have a bounty in the `bounty-slot` provided.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		const completerMembers = [];
		for (const optionalToastee of ["bounty-hunter", "second-bounty-hunter", "third-bounty-hunter", "fourth-bounty-hunter", "fifth-bounty-hunter"]) {
			const guildMember = interaction.options.getMember(optionalToastee);
			if (guildMember?.id !== interaction.user.id) {
				completerMembers.push(guildMember);
			}
		}

		try {
			let { bounty: returnedBounty, allCompleters, poster, company, validatedCompleterIds, bannedIds } = await logicLayer.bounties.addCompleters(bounty, interaction.guild, completerMembers, runMode);
			updateBoardPosting(returnedBounty, company, poster, validatedCompleterIds, allCompleters, interaction.guild);
			interaction.reply({
				content: `Bounty turn-ins for following bounty hunters have been recorded: ${bold(returnedBounty.title)}: ${listifyEN(validatedCompleterIds.map(id => userMention(id)))}\n\nXP and drops will be distributed when you ${commandMention("bounty complete")}.${bannedIds.length > 0 ? `\n\nThe following users were skipped due to currently being banned from using BountyBot: ${listifyEN(bannedIds.map(id => userMention(id)))}` : ""}`,
				flags: [MessageFlags.Ephemeral]
			});
		} catch (e) {
			if (typeof e !== 'string') {
				console.error(e);
			} else {
				interaction.reply({ content: e, flags: [MessageFlags.Ephemeral] });
			}
			return;
		}
	}
).setOptions(
	{
		type: "Integer",
		name: "bounty-slot",
		description: "The slot number of your bounty",
		required: true
	},
	{
		type: "User",
		name: "bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: true
	},
	{
		type: "User",
		name: "second-bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: false
	},
	{
		type: "User",
		name: "third-bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: false
	},
	{
		type: "User",
		name: "fourth-bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: false
	},
	{
		type: "User",
		name: "fifth-bounty-hunter",
		description: "A bounty hunter who turned in the bounty",
		required: false
	}
);
