const { CommandInteraction, userMention, bold, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");
const { extractUserIdsFromMentions, listifyEN, commandMention, congratulationBuilder } = require("../../util/textUtil");
const { addCompleters } = require("../../logic/bounties.js");
const { Completion } = require("../../models/bounties/Completion.js");

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
	let starterMessage = await post.fetchStarterMessage();
	starterMessage.edit({
		embeds: [await bounty.embed(guild, poster.level, false, company, completers)],
		components: bounty.generateBountyBoardButtons()
	});
}

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[string]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[posterId]) {
	const slotNumber = interaction.options.getInteger("bounty-slot");

	const completerIds = extractUserIdsFromMentions(interaction.options.getString("hunters"), [posterId]);
	if (completerIds.length < 1) {
		interaction.reply({ content: "Could not find any user mentions in `hunters` (you can't add yourself).", flags: [MessageFlags.Ephemeral] });
		return;
	}
	
	const completerMembers = Array.from((await interaction.guild.members.fetch({ user: completerIds })).values());

	try {
		let { bounty: returnedBounty, allCompleters, poster, company, validatedCompleterIds, bannedIds } = await addCompleters({slotNumber, posterId}, interaction.guild, completerMembers, runMode);
		updateBoardPosting(returnedBounty, company, poster, validatedCompleterIds, allCompleters, interaction.guild);
		interaction.reply({
			content: `The following bounty hunters have been added as completers to ${bold(returnedBounty.title)}: ${listifyEN(validatedCompleterIds.map(id => userMention(id)))}\n\nThey will recieve the reward XP when you ${commandMention("bounty complete")}.${bannedIds.length > 0 ? `\n\nThe following users were not added, due to currently being banned from using BountyBot: ${listifyEN(bannedIds.map(id => userMention(id)))}` : ""}`,
			flags: [MessageFlags.Ephemeral]
		});
	} catch (e) {
		if (typeof e !== 'string') {
			console.error(e);
		} else {
			interaction.reply({ content: e, flags: [MessageFlags.Ephemeral]});
		}
		return;
	}
};

module.exports = {
	data: {
		name: "add-completers",
		description: "Add hunter(s) to a bounty's list of completers",
		optionsInput: [
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
		]
	},
	executeSubcommand,
	setLogic: (logicBundle) => {
		bounties = logicBundle.bounties;
	}
};
