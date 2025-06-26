const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType, DiscordjsErrorCodes, roleMention } = require("discord.js");
const { SubcommandWrapper } = require("../../classes");
const { SKIP_INTERACTION_HANDLING } = require("../../../constants");
const { rankArrayToSelectOptions, raffleResultEmbed } = require("../../shared");

module.exports = new SubcommandWrapper("by-rank", "Select a user at or above a particular rank",
	async function executeSubcommand(interaction, origin, runMode, logicLayer) {
		const ranks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		if (ranks.length < 1) {
			interaction.reply({ content: "This server doesn't have any ranks configured.", flags: MessageFlags.Ephemeral });
			return;
		}
		const roles = await interaction.guild.roles.fetch();
		interaction.reply({
			content: "Select a rank to be the eligibility threshold for this raffle:",
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
						.setPlaceholder("Select a rank...")
						.addOptions(rankArrayToSelectOptions(ranks, roles))
				)
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
			await collectedInteraction.deferUpdate();
			const threshold = Number(collectedInteraction.values[0]);
			const reloadedRanks = await Promise.all(ranks.map(rank => rank.reload()));
			const rankIndex = reloadedRanks.findIndex(rank => rank.threshold === threshold);
			const rank = reloadedRanks[rankIndex];
			const hunterMap = await logicLayer.hunters.createHunterMapAtOrAboveRank(interaction.guildId, rankIndex);
			const unvalidatedMembers = await interaction.guild.members.fetch({ user: [...hunterMap.keys()] });
			const eligibleMembers = unvalidatedMembers.filter(member => member.manageable);
			if (eligibleMembers.size < 1) {
				collectedInteraction.editReply({ content: `There wouldn't be any eligible bounty hunters for this raffle (at or above the rank ${rank.roleId ? `<@&${rank.roleId}>` : `Rank ${threshold + 1}`}).`, components: [] });
				return;
			}
			const winner = eligibleMembers.at(Math.floor(Math.random() * eligibleMembers.size));
			collectedInteraction.editReply({ components: [] });
			collectedInteraction.channel.send({ embeds: [raffleResultEmbed(hunterMap.get(winner.id).profileColor, collectedInteraction.guild, winner, `Rank ${rank.roleId ? roleMention(rank.roleId) : `Rank ${ranks.reduce((checkedRank, matchingIndex, index) => rank.threshold === checkedRank.threshold ? index : matchingIndex, 0) + 1}`} or higher (${eligibleMembers.size} eligible entrant${eligibleMembers.size === 1 ? "" : "s"})`)] });
			origin.company.update("nextRaffleString", null);
		}).catch(error => {
			if (error.code === DiscordjsErrorCodes.InteractionCollectorError) {
				return;
			}

			if (error.name === "SequelizeInstanceError") {
				interaction.user.send({ content: "A raffle by ranks could not be started because there was an error with finding the rank you selected. Please try again." });
			} else if (error.rawError && Object.values(error.rawError.errors.components).some(row => Object.values(row.components).some(component => Object.values(component.options).some(option => option.emoji.name._errors.some(error => error.code == "BUTTON_COMPONENT_INVALID_EMOJI"))))) {
				interaction.user.send({ content: "A raffle by ranks could not be started because this server has a rank with a non-emoji as a rankmoji.", flags: MessageFlags.Ephemeral });
			} else {
				console.error(error);
			}
		}).finally(() => {
			// If the hosting channel was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
			if (interaction.channel) {
				interaction.deleteReply();
			}
		});
	}
);
