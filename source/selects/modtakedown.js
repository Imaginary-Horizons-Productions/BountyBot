const { database } = require('../../database');
const { InteractionWrapper } = require('../classes');
const { getRankUpdates } = require('../helpers');

const customId = "modtakedown";
module.exports = new InteractionWrapper(customId, 3000,
	/** Take down specified bounty */
	(interaction, [posterId]) => {
		const slotNumber = interaction.values[0];
		database.models.Bounty.findOne({ where: { userId: posterId, guildId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
			await database.models.Completion.destroy({ where: { bountyId: bounty.id } });
			bounty.state = "deleted";
			bounty.save();
			const guildProfile = await database.models.Guild.findOne({ where: { id: interaction.guildId } });
			guildProfile.decrement("seasonXP");
			if (guildProfile.bountyBoardId) {
				const bountyBoard = await interaction.guild.channels.fetch(guildProfile.bountyBoardId);
				const postingThread = await bountyBoard.threads.fetch(bounty.postingId);
				postingThread.delete("Bounty taken down by moderator");
			}
			bounty.destroy();

			database.models.Hunter.findOne({ where: { userId: posterId, guildId: interaction.guildId } }).then(poster => {
				poster.decrement(["xp", "seasonXP"], { by: 1 })
				getRankUpdates(interaction.guild);
			})
			interaction.reply({ content: `<@${posterId}>'s bounty **${bounty.title}** has been taken down by ${interaction.member}.` });
		});
	}
);
