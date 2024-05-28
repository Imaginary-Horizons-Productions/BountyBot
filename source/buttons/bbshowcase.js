const { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { timeConversion } = require('../util/textUtil');

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
						new ChannelSelectMenuBuilder().setCustomId(`${SKIP_INTERACTION_HANDLING}`)
							.setPlaceholder("Select channel...")
							.setChannelTypes(ChannelType.GuildText)
					)
				],
				fetchReply: true,
				ephemeral: true
			}).then(reply => {
				const collector = reply.createMessageComponentCollector({ max: 1 });

				collector.on("collect", async (collectedInteraction) => {
					const showcaseChannel = collectedInteraction.channels.first();
					if (!showcaseChannel.members.has(collectedInteraction.client.user.id)) {
						collectedInteraction.reply({ content: "BountyBot is not in the selected channel.", ephemeral: true });
						return;
					}

					if (!showcaseChannel.permissionsFor(collectedInteraction.user.id).has(PermissionFlagsBits.ViewChannel & PermissionFlagsBits.SendMessages)) {
						collectedInteraction.reply({ content: "You must have permission to view and send messages in the selected channel to showcase a bounty in it.", ephemeral: true });
						return;
					}

					bounty.increment("showcaseCount");
					await bounty.save().then(bounty => bounty.reload());
					const company = await database.models.Company.findByPk(collectedInteraction.guildId);
					poster.lastShowcaseTimestamp = new Date();
					poster.save();
					bounty.asEmbed(collectedInteraction.guild, poster.level, company.festivalMultiplierString(), false, database).then(async embed => {
						if (collectedInteraction.channel.archived) {
							await collectedInteraction.channel.setArchived(false, "bounty showcased");
						}
						interaction.message.edit({ embeds: [embed] });
						showcaseChannel.send({ content: `${collectedInteraction.member} increased the reward on their bounty!`, embeds: [embed] });
					})
				})

				collector.on("end", () => {
					interaction.deleteReply();
				})
			})
		})
	}
);
