const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ComponentType, DiscordjsErrorCodes } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { getRankUpdates } = require('../util/scoreUtil');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "bbtakedown";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, [bountyId], database, runMode) => {
		database.models.Bounty.findByPk(bountyId).then(async bounty => {
			await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
			if (bounty.userId !== interaction.user.id) {
				interaction.editReply({ content: "Only the bounty poster can take down their bounty." });
				return;
			}

			interaction.editReply({
				content: `Really take down this bounty?`,
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}confirm`)
							.setStyle(ButtonStyle.Success)
							.setEmoji("✔")
							.setLabel("Confirm")
					)
				]
			}).then(message => message.awaitMessageComponent({ time: 120000, componentType: ComponentType.Button })).then(async collectedInteraction => {
				const bounty = await logicLayer.bounties.findBounty(bountyId);
				bounty.state = "deleted";
				bounty.save();
				database.models.Completion.destroy({ where: { bountyId: bounty.id } });
				bounty.destroy();

				logicLayer.hunters.findOneHunter(interaction.user.id, interaction.guild.id).then(async hunter => {
					hunter.decrement("xp");
					const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
					logicLayer.seasons.changeSeasonXP(interaction.user.id, interaction.guildId, season.id, -1);
					getRankUpdates(interaction.guild, logicLayer);
				})

				return collectedInteraction.reply({ content: "Your bounty has been taken down.", flags: [MessageFlags.Ephemeral] });
			}).catch(error => {
				if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
					console.error(error);
				}
			}).finally(() => {
				interaction.channel.delete("Bounty taken down by poster");
			});
		})
	}
).setLogicLinker(logicBundle => {
	logicLayer = logicBundle;
});
