const { InteractionWrapper } = require('../classes');
const { database } = require('../../database');

const customId = "evergreentakedown";
module.exports = new InteractionWrapper(customId, 3000,
	/** Take down the given bounty and completions */
	async (interaction, args) => {
		const slotNumber = interaction.values[0];
		const bounty = await database.models.Bounty.findOne({ where: { userId: interaction.client.user.id, guildId: interaction.guildId, slotNumber, state: "open" } });
		bounty.state = "deleted";
		bounty.save();
		database.models.Completion.destroy({ where: { bountyId: bounty.id } });
		const guildProfile = await database.models.Guild.findOne({ where: { id: interaction.guildId } });
		const evergreenBounties = await database.models.Bounty.findAll({ where: { guildId: interaction.guildId, userId: interaction.client.user.id, state: "open" }, order: [["slotNumber", "ASC"]] });
		if (evergreenBounties.length > 1) {
			const embeds = await Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(interaction.guild, guildProfile.level, guildProfile.eventMultiplierString())));
			if (guildProfile.bountyBoardId) {
				const bountyBoard = await interaction.guild.channels.fetch(guildProfile.bountyBoardId);
				bountyBoard.threads.fetch(guildProfile.evergreenThreadId).then(async thread => {
					const message = await thread.fetchStarterMessage();
					message.edit({ embeds });
				});
			}
		} else if (guildProfile.bountyBoardId) {
			const bountyBoard = await interaction.guild.channels.fetch(guildProfile.bountyBoardId);
			bountyBoard.threads.fetch(guildProfile.evergreenThreadId).then(thread => {
				thread.delete(`Evergreen bounty taken down by ${interaction.member}`);
				guildProfile.evergreenThreadId = null;
				guildProfile.save();
			});
		}
		bounty.destroy();

		interaction.reply({ content: "The evergreen bounty has been taken down.", ephemeral: true });
	}
);
