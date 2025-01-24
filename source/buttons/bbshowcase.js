const { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, ComponentType, DiscordjsErrorCodes } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { timeConversion } = require('../util/textUtil');
const { showcaseBounty } = require('../util/bountyUtil');

const mainId = "bbshowcase";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, [bountyId], database, runMode) => {
		database.models.Bounty.findByPk(bountyId).then(async bounty => {
			if (bounty.userId !== interaction.user.id) {
				interaction.reply({ content: "Only the bounty poster can showcase the bounty.", ephemeral: true });
				return;
			}

			const poster = await database.models.Hunter.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId } });
			const nextShowcaseInMS = new Date(poster.lastShowcaseTimestamp).valueOf() + timeConversion(1, "w", "ms");
			if (Date.now() < nextShowcaseInMS) {
				interaction.reply({ content: `You can showcase another bounty in <t:${Math.floor(nextShowcaseInMS / 1000)}:R>.`, ephemeral: true });
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
				fetchReply: true,
				ephemeral: true
			}).then(message => message.awaitMessageComponent({ time: timeConversion(2, "m", "ms"), componentType: ComponentType.ChannelSelect })).then(collectedInteraction => {
				showcaseBounty(collectedInteraction, bountyId, collectedInteraction.channels.first(), false, database);
			}).catch(error => {
				if (error.code !== DiscordjsErrorCodes.InteractionCollectorError) {
					console.error(error);
				}
			}).finally(() => {
				interaction.deleteReply();
			})
		})
	}
);
