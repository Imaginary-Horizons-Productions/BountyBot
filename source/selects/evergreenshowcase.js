const { database } = require('../../database');
const { InteractionWrapper } = require('../classes');

const customId = "evergreenshowcase";
module.exports = new InteractionWrapper(customId, 3000,
	/** Show the evergreen bounty's embed again */
	(interaction, args) => {
		const [slotNumber] = interaction.values;
		database.models.Bounty.findOne({ where: { isEvergreen: true, companyId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
			const company = await database.models.Company.findByPk(interaction.guildId);
			return bounty.asEmbed(interaction.guild, company.level, company.eventMultiplierString());
		}).then(embed => {
			interaction.reply({ embeds: [embed] });
		});
	}
);
