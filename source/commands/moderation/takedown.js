const { CommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType, DiscordjsErrorCodes } = require("discord.js");
const { Sequelize } = require("sequelize");
const { SAFE_DELIMITER, SKIP_INTERACTION_HANDLING } = require("../../constants");
const { getRankUpdates } = require("../../util/scoreUtil");
const { bountiesToSelectOptions } = require("../../util/messageComponentUtil");

/**
 * @param {CommandInteraction} interaction
 * @param {Sequelize} database
 * @param {string} runMode
 * @param {[typeof import("../../logic")]} args
 */
async function executeSubcommand(interaction, database, runMode, ...[logicLayer]) {
	const poster = interaction.options.getUser("poster");
	const openBounties = await database.models.Bounty.findAll({ where: { userId: poster.id, companyId: interaction.guildId, state: "open" } });
	if (openBounties.length < 1) {
		interaction.reply({ content: `${poster} doesn't seem to have any open bounties at the moment.`, flags: [MessageFlags.Ephemeral] });
		return;
	}

	interaction.reply({
		content: "The poster will also lose the XP they gained for posting the removed bounty.",
		components: [
			new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${SAFE_DELIMITER}${poster.id}`)
					.setPlaceholder("Select a bounty to take down...")
					.setMaxValues(1)
					.setOptions(bountiesToSelectOptions(openBounties))
			)
		],
		flags: [MessageFlags.Ephemeral],
		withResponse: true
	}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
		const posterId = collectedInteraction.customId.split(SAFE_DELIMITER)[1];
		const [bountyId] = collectedInteraction.values;
		database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company }).then(async bounty => {
			await database.models.Completion.destroy({ where: { bountyId: bounty.id } });
			bounty.state = "deleted";
			bounty.save();
			const [company] = await logicLayer.companies.findOrCreateCompany(interaction.guildId);
			if (company.bountyBoardId) {
				const bountyBoard = await interaction.guild.channels.fetch(company.bountyBoardId);
				const postingThread = await bountyBoard.threads.fetch(bounty.postingId);
				postingThread.delete("Bounty taken down by moderator");
			}
			bounty.destroy();

			logicLayer.hunters.findOneHunter(posterId, interaction.guild.id).then(async poster => {
				poster.decrement("xp");
				const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
				const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { userId: posterId, companyId: interaction.guildId, seasonId: season.id }, defaults: { xp: -1 } });
				if (!participationCreated) {
					participation.decrement("xp");
				}
				getRankUpdates(interaction.guild, database);
			})
			collectedInteraction.reply({ content: `<@${posterId}>'s bounty **${bounty.title}** has been taken down by ${interaction.member}.` });
		});
	}).catch(error => {
		if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
			console.error(error);
		}
	}).finally(() => {
		// If the hosting channel was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
		if (interaction.channel) {
			interaction.deleteReply();
		}
	})
};

module.exports = {
	data: {
		name: "take-down",
		description: "Take down another user's bounty",
		optionsInput: [
			{
				type: "User",
				name: "poster",
				description: "The mention of the poster of the bounty",
				required: true
			}
		]
	},
	executeSubcommand
};
