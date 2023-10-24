const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { database } = require('../../database');
const { getRankUpdates } = require('../helpers');
const { buildCompanyStatsEmbed } = require('../embedHelpers');

const mainId = "season-end";
const options = [];
const subcommands = [];
module.exports = new CommandWrapper(mainId, "Start a new season for this server, resetting ranks and placements", PermissionFlagsBits.ManageGuild, false, false, 3000, options, subcommands,
	/** End the Company's current season and start a new one */
	async (interaction) => {
		const company = await database.models.Company.findByPk(interaction.guildId);
		if (!company) {
			interaction.reply({ content: "This server hasn't used BountyBot yet, so it doesn't have a season to end.", ephemeral: true });
			return;
		}

		buildCompanyStatsEmbed(interaction.guild).then(async embed => {
			const seasonBeforeEndingSeason = await database.models.Season.findOne({ where: { companyId: interaction.guildId, isPreviousSeason: true } });
			if (seasonBeforeEndingSeason) {
				seasonBeforeEndingSeason.isPreviousSeason = false;
				seasonBeforeEndingSeason.save();
			}
			const endingSeason = await database.models.Season.findOne({ where: { companyId: interaction.guildId, isCurrentSeason: true } });
			if (endingSeason) {
				endingSeason.isCurrentSeason = false;
				endingSeason.isPreviousSeason = true;
				endingSeason.save();
			}
			await database.models.Season.create({ companyId: interaction.guildId });
			await database.models.Hunter.update({ seasonParticipationId: null, rank: null, lastRank: null, nextRankXP: null }, { where: { companyId: company.id } });
			getRankUpdates(interaction.guild);
			interaction.reply(company.sendAnnouncement({ content: "A new season has started, ranks and placements have been reset!", embeds: [embed] }));
		})
	}
);
