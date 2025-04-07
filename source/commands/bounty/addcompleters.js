const { userMention, bold, MessageFlags, Guild } = require("discord.js");
const { extractUserIdsFromMentions, listifyEN, commandMention, congratulationBuilder } = require("../../util/textUtil");
const { Completion } = require("../../models/bounties/Completion.js");
const { Bounty } = require("../../models/bounties/Bounty.js");
const { Company } = require("../../models/companies/Company.js");
const { Hunter } = require("../../models/users/Hunter.js");
const { SubcommandWrapper } = require("../../classes");

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
	post.send({ content: `${listifyEN(newCompleterIds.map(id => userMention(id)))} ${numCompleters === 1 ? "has" : "have"} been added as ${numCompleters === 1 ? "a completer" : "completers"} of this bounty! ${congratulationBuilder()}!` });
	(await post.fetchStarterMessage()).edit({
		embeds: [await bounty.embed(guild, poster.getLevel(company.xpCoefficient), false, company, completers)],
		components: bounty.generateBountyBoardButtons()
	});
}

module.exports = new SubcommandWrapper("add-completers", "Add hunter(s) to a bounty's list of completers",
	async function executeSubcommand(interaction, runMode, ...[logicLayer, posterId]) {
		const slotNumber = interaction.options.getInteger("bounty-slot");

		const bounty = await logicLayer.bounties.findBounty({ slotNumber, userId: posterId, companyId: interaction.guild.id });
		if (!bounty) {
			interaction.reply({ content: "You don't have a bounty in the `bounty-slot` provided.", flags: [MessageFlags.Ephemeral] });
			return;
		}

		const completerIds = extractUserIdsFromMentions(interaction.options.getString("hunters"), [posterId]);
		if (completerIds.length < 1) {
			interaction.reply({ content: "Could not find any user mentions in `hunters` (you can't add yourself).", flags: [MessageFlags.Ephemeral] });
			return;
		}

		const completerMembers = Array.from((await interaction.guild.members.fetch({ user: completerIds })).values());
		try {
			let { bounty: returnedBounty, allCompleters, poster, company, validatedCompleterIds, bannedIds } = await logicLayer.bounties.addCompleters(bounty, interaction.guild, completerMembers, runMode);
			updateBoardPosting(returnedBounty, company, poster, validatedCompleterIds, allCompleters, interaction.guild);
			interaction.reply({
				content: `The following bounty hunters have been added as completers to ${bold(returnedBounty.title)}: ${listifyEN(validatedCompleterIds.map(id => userMention(id)))}\n\nThey will recieve the reward XP when you ${commandMention("bounty complete")}.${bannedIds.length > 0 ? `\n\nThe following users were not added, due to currently being banned from using BountyBot: ${listifyEN(bannedIds.map(id => userMention(id)))}` : ""}`,
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
		description: "The slot number of the bounty to add completers to",
		required: true
	},
	{
		type: "String",
		name: "hunters",
		description: "The bounty hunter(s) to add as completer(s)",
		required: true
	}
);
