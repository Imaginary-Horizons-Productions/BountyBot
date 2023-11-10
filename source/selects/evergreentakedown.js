const { SelectWrapper } = require('../classes');
const { database } = require('../../database');

const mainId = "evergreentakedown";
module.exports = new SelectWrapper(mainId, 3000,
	/** Take down the given bounty and completions */
	async (interaction, args) => {
		const [slotNumber] = interaction.values;
		const bounty = await database.models.Bounty.findOne({ where: { userId: interaction.client.user.id, companyId: interaction.guildId, slotNumber, state: "open" } });
		bounty.state = "deleted";
		bounty.save();
		database.models.Completion.destroy({ where: { bountyId: bounty.id } });
		const company = await database.models.Company.findOne({ where: { id: interaction.guildId } });
		const evergreenBounties = await database.models.Bounty.findAll({ where: { companyId: interaction.guildId, userId: interaction.client.user.id, state: "open" }, order: [["slotNumber", "ASC"]] });
		if (evergreenBounties.length > 0) {
			const embeds = await Promise.all(evergreenBounties.map(bounty => bounty.asEmbed(interaction.guild, company.level, company.eventMultiplierString())));
			if (company.bountyBoardId) {
				const bountyBoard = await interaction.guild.channels.fetch(company.bountyBoardId);
				bountyBoard.threads.fetch(company.evergreenThreadId).then(async thread => {
					const message = await thread.fetchStarterMessage();
					message.edit({ embeds });
				});
			}
		} else if (company.bountyBoardId) {
			const bountyBoard = await interaction.guild.channels.fetch(company.bountyBoardId);
			bountyBoard.threads.fetch(company.evergreenThreadId).then(thread => {
				thread.delete(`Evergreen bounty taken down by ${interaction.member}`);
				company.evergreenThreadId = null;
				company.save();
			});
		}
		bounty.destroy();

		interaction.reply({ content: "The evergreen bounty has been taken down.", ephemeral: true });
	}
);
