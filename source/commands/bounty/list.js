const { CommandInteraction, MessageFlags } = require("discord.js");
const { Sequelize } = require("sequelize");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[string]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[userId]) {
	const listUserId = interaction.options.getUser("bounty-hunter")?.id ?? userId;
	database.models.Bounty.findAll({ where: { userId: listUserId, companyId: interaction.guildId, state: "open" }, order: [["slotNumber", "ASC"]] }).then(async existingBounties => {
		if (existingBounties.length < 1) {
			interaction.reply({ content: `<@${listUserId}> doesn't have any open bounties posted.`, flags: [MessageFlags.Ephemeral] });
			return;
		}
		const hunter = await database.models.Hunter.findOne({ where: { userId: listUserId, companyId: interaction.guildId } });
		const company = await database.models.Company.findByPk(interaction.guildId);
		interaction.reply({ embeds: await Promise.all(existingBounties.map(async bounty => bounty.embed(interaction.guild, hunter?.level ?? company.level, false, company, await database.models.Completion.findAll({ where: { bountyId: bounty.id } })))), flags: [MessageFlags.Ephemeral] });
	});
};

module.exports = {
	data: {
		name: "list",
		description: "List all of a hunter's open bounties (default: your own)",
		optionsInput: [
			{
				type: "User",
				name: "bounty-hunter",
				description: "The bounty hunter to show open bounties for",
				required: false
			}
		]
	},
	executeSubcommand
};
