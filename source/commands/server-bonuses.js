const { InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { buildServerBonusesEmbed } = require('../util/embedUtil');

const mainId = "server-bonuses";
module.exports = new CommandWrapper(mainId, "Get info about the currently running server bonuses", null, false, [InteractionContextType.Guild], 3000,
	/** Send the user info about currently running server bonuses */
	(interaction, database, runMode) => {
		database.models.Company.findOrCreate({ where: { id: interaction.guildId } }).then(([company]) => {
			return buildServerBonusesEmbed(interaction.channel, interaction.guild, company);
		}).then(embed => {
			interaction.reply({ embeds: [embed], ephemeral: true });
		});
	}
);
