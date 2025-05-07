const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ComponentType, DiscordjsErrorCodes } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../../constants');
const { getRankUpdates } = require('../shared');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "bbtakedown";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, runMode, [bountyId]) => {
		logicLayer.bounties.findBounty(bountyId).then(async bounty => {
			if (bounty.userId !== interaction.user.id) {
				interaction.reply({ content: "Only the bounty poster can take down their bounty.", flags: MessageFlags.Ephemeral });
				return;
			}

			interaction.reply({
				content: `Really take down this bounty?`,
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}confirm`)
							.setStyle(ButtonStyle.Success)
							.setEmoji("✔")
							.setLabel("Confirm")
					)
				],
				flags: MessageFlags.Ephemeral,
				withResponse: true
			}).then(response => response.resource.message.awaitMessageComponent({ time: 120000, componentType: ComponentType.Button })).then(async collectedInteraction => {
				await collectedInteraction.deferReply({ flags: MessageFlags.Ephemeral });
				await bounty.reload();
				bounty.state = "deleted";
				bounty.save();
				logicLayer.bounties.deleteBountyCompletions(bountyId);
				bounty.destroy();

				logicLayer.hunters.findOneHunter(interaction.user.id, interaction.guild.id).then(async hunter => {
					hunter.decrement("xp");
					const [season] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guild.id);
					logicLayer.seasons.changeSeasonXP(interaction.user.id, interaction.guildId, season.id, -1);
					getRankUpdates(interaction.guild, logicLayer);
				})

				return collectedInteraction.editReply({ content: "Your bounty has been taken down." });
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
