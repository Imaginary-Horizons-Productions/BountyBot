const { database } = require('../../database');
const { InteractionWrapper } = require('../classes');

const customId = "evergreenshowcase";
module.exports = new InteractionWrapper(customId, 3000,
	/** Show the evergreen bounty's embed again */
	(interaction, args) => {
		const slotNumber = interaction.values[0];
		database.models.Bounty.findOne({ where: { isEvergreen: true, guildId: interaction.guildId, slotNumber, state: "open" } }).then(async bounty => {
			const guildProfile = await database.models.Guild.findByPk(interaction.guildId);
			return bounty.asEmbed(interaction.guild, guildProfile.level, guildProfile.eventMultiplierString());
		}).then(embed => {
			interaction.reply({ embeds: [embed] });
		});
	}
);
