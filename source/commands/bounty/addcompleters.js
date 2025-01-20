const { CommandInteraction, userMention, bold } = require("discord.js");
const { Sequelize } = require("sequelize");
const { extractUserIdsFromMentions, listifyEN, commandMention, congratulationBuilder } = require("../../util/textUtil");
const { addCompleters } = require("../../logic/bounties.js");

/**
 * Updates the board posting for the bounty after adding the completers
 * @param {Bounty} bounty 
 * @param {Company} company 
 * @param {Hunter} poster 
 * @param {UserId[]} numCompleters 
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
		embeds: [await bounty.embed(guild, poster.level, company.festivalMultiplierString(), false, company, completers)],
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
	const bounty = await database.models.Bounty.findOne({ where: { userId: posterId, companyId: interaction.guildId, slotNumber, state: "open" }, include: database.models.Bounty.Company });
	if (!bounty) {
		interaction.reply({ content: "You don't have a bounty in the `bounty-slot` provided.", ephemeral: true });
		return;
	}

	const completerIds = extractUserIdsFromMentions(interaction.options.getString("hunters"), [posterId]);
	const validatedCompleterIds = [];
	if (completerIds.length < 1) {
		interaction.reply({ content: "Could not find any user mentions in `hunters` (you can't add yourself).", ephemeral: true });
		return;
	}

	const completerMembers = (await interaction.guild.members.fetch({ user: completerIds })).values();
	const existingCompletions = await database.models.Completion.findAll({ where: { bountyId: bounty.id, companyId: interaction.guildId } });
	const existingCompleterIds = existingCompletions.map(completion => completion.userId);
	const bannedIds = [];
	for (const member of completerMembers) {
		const memberId = member.id;
		if (!existingCompleterIds.includes(memberId)) {
			await database.models.User.findOrCreate({ where: { id: memberId } });
			const [hunter] = await database.models.Hunter.findOrCreate({ where: { userId: memberId, companyId: interaction.guildId } });
			if (hunter.isBanned) {
				bannedIds.push(memberId);
				continue;
			}
			if (runMode !== "prod" || !member.user.bot) {
				existingCompleterIds.push(memberId);
				validatedCompleterIds.push(memberId);
			}
		}
	}
	if (validatedCompleterIds.length < 1) {
		interaction.reply({ content: "Could not find any new non-bot mentions in `hunters`.", ephemeral: true });
		return;
	}

	let {bounty: returnedBounty, allCompleters, poster, company} = await addCompleters(interaction.guild, bounty, validatedCompleterIds);
	updateBoardPosting(returnedBounty, company, poster, validatedCompleterIds, allCompleters, interaction.guild);
	interaction.reply({
		content: `The following bounty hunters have been added as completers to ${bold(bounty.title)}: ${listifyEN(validatedCompleterIds.map(id => userMention(id)))}\n\nThey will recieve the reward XP when you ${commandMention("bounty complete")}.${bannedIds.length > 0 ? `\n\nThe following users were not added, due to currently being banned from using BountyBot: ${listifyEN(bannedIds.map(id => userMention(id)))}` : ""}`,
		ephemeral: true
	});
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
