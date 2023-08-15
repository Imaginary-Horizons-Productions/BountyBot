const { InteractionWrapper } = require('../classes');
const { database } = require('../../database');
const { getRankUpdates } = require('../helpers');

const customId = "bountytakedown";
module.exports = new InteractionWrapper(customId, 3000,
	/** Take down the given bounty and completions */
	async (interaction, args) => {
		const [slotNumber] = interaction.values;
		const bounty = await database.models.Bounty.findOne({ where: { userId: interaction.user.id, guildId: interaction.guildId, slotNumber, state: "open" } });
		bounty.state = "deleted";
		bounty.save();
		database.models.Completion.destroy({ where: { bountyId: bounty.id } });
		const guildProfile = await database.models.Guild.findOne({ where: { id: interaction.guildId } });
		guildProfile.decrement("seasonXP");
		guildProfile.save();
		if (guildProfile.bountyBoardId) {
			const bountyBoard = await interaction.guild.channels.fetch(guildProfile.bountyBoardId);
			const postingThread = await bountyBoard.threads.fetch(bounty.postingId);
			postingThread.delete("Bounty taken down by poster");
		}
		bounty.destroy();

		database.models.Hunter.findOne({ where: { userId: interaction.user.id, guildId: interaction.guildId } }).then(hunter => {
			hunter.decrement(["xp", "seasonXP"], { by: 1 });
			getRankUpdates(interaction.guild);
		})

		interaction.reply({ content: "Your bounty has been taken down.", ephemeral: true });
	}
);
