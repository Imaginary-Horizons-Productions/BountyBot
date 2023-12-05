const { SelectWrapper } = require('../classes');

const mainId = "evergreentakedown";
module.exports = new SelectWrapper(mainId, 3000,
	/** Take down the given bounty and completions */
	async (interaction, args, database) => {
		const [bountyId] = interaction.values;
		const bounty = await database.models.Bounty.findByPk(bountyId, { include: database.models.Bounty.Company });
		bounty.state = "deleted";
		bounty.save();
		database.models.Completion.destroy({ where: { bountyId: bounty.id } });
		const evergreenBounties = await database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.client.user.id, state: "open" }, order: [["slotNumber", "ASC"]] });
		if (evergreenBounties.length > 0) {
			const embeds = await Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(interaction.guild, bounty.Company.level, bounty.Company.festivalMultiplierString(), database)));
			if (bounty.Company.bountyBoardId) {
				const bountyBoard = await interaction.guild.channels.fetch(bounty.Company.bountyBoardId);
				bountyBoard.threads.fetch(bounty.Company.evergreenThreadId).then(async thread => {
					const message = await thread.fetchStarterMessage();
					message.edit({ embeds });
				});
			}
		} else if (bounty.Company.bountyBoardId) {
			const bountyBoard = await interaction.guild.channels.fetch(bounty.Company.bountyBoardId);
			bountyBoard.threads.fetch(bounty.Company.evergreenThreadId).then(thread => {
				thread.delete(`Evergreen bounty taken down by ${interaction.member}`);
				return database.models.Company.findByPk(bounty.companyId);
			}).then(company => {
				company.evergreenThreadId = null;
				company.save();
			});
		}
		bounty.destroy();

		interaction.reply({ content: "The evergreen bounty has been taken down.", ephemeral: true });
	}
);
