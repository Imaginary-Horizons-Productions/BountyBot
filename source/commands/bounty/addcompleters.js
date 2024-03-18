const { CommandInteraction } = require("discord.js");
const { Sequelize } = require("sequelize");
const { extractUserIdsFromMentions, commandMention } = require("../../util/textUtil");

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

	const rawCompletions = [];
	for (const userId of validatedCompleterIds) {
		rawCompletions.push({
			bountyId: bounty.id,
			userId,
			companyId: interaction.guildId
		})
	}
	database.models.Completion.bulkCreate(rawCompletions);
	bounty.updatePosting(interaction.guild, bounty.Company, database);

	interaction.reply({
		content: `The following bounty hunters have been added as completers to **${bounty.title}**: <@${validatedCompleterIds.join(">, <@")}>\n\nThey will recieve the reward XP when you ${commandMention("bounty complete")}.${bannedIds.length > 0 ? `\n\nThe following users were not added, due to currently being banned from using BountyBot: <@${bannedIds.join(">, ")}>` : ""}`,
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
	executeSubcommand
};
