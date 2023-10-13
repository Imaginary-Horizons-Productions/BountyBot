const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');
const { updateScoreboard } = require('../embedHelpers');

const mainId = "reset";
const options = [];
const subcommands = [
	{
		name: "all-hunter-stats",
		description: "IRREVERSIBLY reset all bounty hunter stats on this server",
	},
	{
		name: "server-settings",
		description: "IRREVERSIBLY return all server configs to default",
	}
];
module.exports = new CommandWrapper(mainId, "Reset all bounty hunter stats, bounties, or server configs", PermissionFlagsBits.ManageGuild, false, false, 3000, options, subcommands,
	(interaction) => {
		switch (interaction.options.getSubcommand()) {
			case subcommands[0].name: // all-hunter-stats
				database.models.Hunter.destroy({ where: { companyId: interaction.guildId } });
				interaction.reply({ content: "Resetting bounty hunter stats has begun.", ephemeral: true });
				database.models.Company.findByPk(interaction.guildId).then(async company => {
					await database.models.SeasonParticipation.destroy({ where: { seasonId: company.seasonId } });
					updateScoreboard(company, interaction.guild);
					interaction.user.send(`Resetting bounty hunter stats on ${interaction.guild.name} has completed.`);
				});
				break;
			case subcommands[1].name: // server-settings
				database.models.Company.update(
					{
						announcementPrefix: "@here",
						disableBoostXP: true,
						maxSimBounties: 5,
						backupTimer: 3600000,
						eventMultiplier: 1,
						xpCoefficient: 3
					},
					{ where: { id: interaction.guildId } }
				);
				interaction.reply({ content: "Server settings have been reset.", ephemeral: true });
				break;
		}
	}
);
