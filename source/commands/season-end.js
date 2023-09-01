const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');
const { getRankUpdates } = require('../helpers');
const { buildCompanyStatsEmbed } = require('../embedHelpers');

const customId = "season-end";
const options = [];
const subcommands = [];
module.exports = new CommandWrapper(customId, "Start a new season for this server, resetting ranks and placements", PermissionFlagsBits.ManageGuild, false, false, 3000, options, subcommands,
	/** End the Company's current season and start a new one */
	async (interaction) => {
		const company = await database.models.Company.findByPk(interaction.guildId);
		if (!company) {
			interaction.reply({ content: "This server hasn't used BountyBot yet, so it doesn't have a season to end.", ephemeral: true });
			return;
		}

		buildCompanyStatsEmbed(interaction.guild).then(async embed => {
			const newSeason = await database.models.Season.create({ companyId: company.id });
			company.lastSeasonId = company.seasonId;
			company.seasonId = newSeason.id;
			company.save();
			await database.models.Hunter.update({ seasonParticipationId: null, rank: null, lastRank: null, nextRankXP: null }, { where: { companyId: company.id } });
			getRankUpdates(interaction.guild);
			interaction.reply(company.sendAnnouncement({ content: "A new season has started, ranks and placements have been reset!", embeds: [embed] }));
		})
	}
);
