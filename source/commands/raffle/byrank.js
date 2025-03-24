const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType, DiscordjsErrorCodes } = require("discord.js");
const { SKIP_INTERACTION_HANDLING } = require("../../constants");
const { SubcommandWrapper } = require("../../classes");

module.exports = new SubcommandWrapper("by-rank", "Select a user at or above a particular rank",
	async function executeSubcommand(interaction, runMode, ...[logicLayer]) {
		const ranks = await logicLayer.ranks.findAllRanks(interaction.guild.id);
		if (ranks.length < 1) {
			interaction.reply({ content: "This server doesn't have any ranks configured.", flags: [MessageFlags.Ephemeral] });
			return;
		}
		const guildRoles = await interaction.guild.roles.fetch();
		interaction.reply({
			content: "Select a rank to be the eligibility threshold for this raffle:",
			components: [
				new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}${interaction.id}`)
						.setPlaceholder("Select a rank...")
						.addOptions(ranks.map((rank, index) => {
							const option = {
								label: rank.roleId ? guildRoles.get(rank.roleId).name : `Rank ${index + 1}`,
								description: `Variance Threshold: ${rank.varianceThreshold}`,
								value: rank.varianceThreshold.toString()
							};
							if (rank.rankmoji) {
								option.emoji = rank.rankmoji;
							}
							return option;
						}))
				)
			],
			flags: [MessageFlags.Ephemeral],
			withResponse: true
		}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.StringSelect })).then(async collectedInteraction => {
			const varianceThreshold = Number(collectedInteraction.values[0]);
			const reloadedRanks = await Promise.all(ranks.map(rank => rank.reload()));
			const rankIndex = reloadedRanks.findIndex(rank => rank.varianceThreshold === varianceThreshold);
			if (rankIndex === -1) {
				collectedInteraction.reply({ content: "There was an error with finding the rank you selected.", flags: [MessageFlags.Ephemeral] });
				return;
			}
			const qualifiedHunterIds = await logicLayer.hunters.findHunterIdsAtOrAboveRank(interaction.guildId, rankIndex);
			const unvalidatedMembers = await interaction.guild.members.fetch({ user: qualifiedHunterIds });
			const eligibleMembers = unvalidatedMembers.filter(member => member.manageable);
			if (eligibleMembers.size < 1) {
				collectedInteraction.reply({ content: `There wouldn't be any eligible bounty hunters for this raffle (at or above the rank ${rank.roleId ? `<@&${rank.roleId}>` : `Rank ${varianceThreshold + 1}`}).`, flags: [MessageFlags.Ephemeral] });
				return;
			}
			const winner = eligibleMembers.at(Math.floor(Math.random() * eligibleMembers.size));
			collectedInteraction.reply(`The winner of this raffle is: ${winner}`);
			logicLayer.companies.findCompanyByPK(interaction.guild.id).then(company => {
				company.update("nextRaffleString", null);
			});
		}).catch(error => {
			if (Object.values(error.rawError.errors.data.components).some(row => Object.values(row.components).some(component => Object.values(component.options).some(option => option.emoji.name._errors.some(error => error.code == "BUTTON_COMPONENT_INVALID_EMOJI"))))) {
				interaction.reply({ content: "A raffle by ranks could not be started because this server has a rank with a non-emoji as a rankmoji.", flags: [MessageFlags.Ephemeral] });
			} else if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
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
