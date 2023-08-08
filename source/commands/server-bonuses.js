const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');
const { buildServerBonusesEmbed } = require('../embedHelpers');

const customId = "server-bonuses";
const options = [];
const subcommands = [];
module.exports = new CommandWrapper(customId, "Get info about the currently running server bonuses", PermissionFlagsBits.ViewChannel, false, false, 3000, options, subcommands,
	/** Send the user info about currently running server bonuses */
	(interaction) => {
		database.models.Guild.findOrCreate({ where: { id: interaction.guildId } }).then(([guildProfile]) => {
			return buildServerBonusesEmbed(interaction.channel, interaction.guild, guildProfile);
		}).then(embed => {
			interaction.reply({ embeds: [embed], ephemeral: true });
		});
	}
);
