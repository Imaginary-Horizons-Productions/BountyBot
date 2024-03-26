const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ButtonWrapper } = require('../classes');
const { SKIP_INTERACTION_HANDLING } = require('../constants');
const { getRankUpdates } = require('../util/scoreUtil');

const mainId = "bbtakedown";
module.exports = new ButtonWrapper(mainId, 3000,
	(interaction, [bountyId], database, runMode) => {
		database.models.Bounty.findByPk(bountyId).then(async bounty => {
			await interaction.deferReply({ ephemeral: true });
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
			}).then(reply => {
				const collector = reply.createMessageComponentCollector({ max: 1 });

				collector.on("collect", async collectedInteraction => {
					const bounty = await database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company });
					bounty.state = "deleted";
					bounty.save();
					database.models.Completion.destroy({ where: { bountyId: bounty.id } });
					interaction.channel.delete("Bounty taken down by poster");
					bounty.destroy();

					database.models.Hunter.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId } }).then(async hunter => {
						hunter.decrement("xp");
						const [season] = await database.models.Season.findOrCreate({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
						const [participation, participationCreated] = await database.models.Participation.findOrCreate({ where: { userId: interaction.user.id, companyId: interaction.guildId, seasonId: season.id }, defaults: { xp: -1 } });
						if (!participationCreated) {
							participation.decrement("xp");
						}
						getRankUpdates(interaction.guild, database);
					})

					collectedInteraction.reply({ content: "Your bounty has been taken down.", ephemeral: true });
				})
			});
		})
	}
);
