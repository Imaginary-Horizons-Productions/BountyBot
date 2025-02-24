const { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, ComponentType, DiscordjsErrorCodes, MessageFlags } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { timeConversion } = require('../util/textUtil');
const { showcaseBounty } = require('../util/bountyUtil');

/** @type {typeof import("../logic")} */
let logicLayer;

const mainId = "bbshowcase";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, [bountyId], database, runMode) => {
		database.models.Bounty.findByPk(bountyId).then(async bounty => {
			if (bounty.userId !== interaction.user.id) {
				interaction.reply({ content: "Only the bounty poster can showcase the bounty.", flags: [MessageFlags.Ephemeral] });
				return;
			}

			const poster = await logicLayer.hunters.findOneHunter(interaction.user.id, interaction.guild.id);
			const nextShowcaseInMS = new Date(poster.lastShowcaseTimestamp).valueOf() + timeConversion(1, "w", "ms");
			if (runMode === "prod" && Date.now() < nextShowcaseInMS) {
				interaction.reply({ content: `You can showcase another bounty in <t:${Math.floor(nextShowcaseInMS / 1000)}:R>.`, flags: [MessageFlags.Ephemeral] });
				return;
			}

			interaction.reply({
				content: "Which channel should this bounty be showcased in?",
				components: [
					new ActionRowBuilder().addComponents(
						new ChannelSelectMenuBuilder().setCustomId(SKIP_INTERACTION_HANDLING)
							.setPlaceholder("Select channel...")
							.setChannelTypes(ChannelType.GuildText)
					)
				],
				flags: [MessageFlags.Ephemeral],
				withResponse: true
			}).then(response => response.resource.message.awaitMessageComponent({ time: timeConversion(2, "m", "ms"), componentType: ComponentType.ChannelSelect })).then(collectedInteraction => {
				showcaseBounty(collectedInteraction, bountyId, collectedInteraction.channels.first(), false, database, logicLayer);
			}).catch(error => {
				if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
					console.error(error);
				}
			}).finally(() => {
				// If the bounty thread was deleted before cleaning up `interaction`'s reply, don't crash by attempting to clean up the reply
				if (interaction.channel) {
					interaction.deleteReply();
				}
			})
		})
	}
).setLogicLinker(logicBundle => {
	logicLayer = logicBundle;
});
