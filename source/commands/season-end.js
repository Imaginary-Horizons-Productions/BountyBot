const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { getRankUpdates } = require('../util/scoreUtil');
const { buildCompanyStatsEmbed } = require('../util/embedUtil');

const mainId = "season-end";
module.exports = new CommandWrapper(mainId, "Start a new season for this server, resetting ranks and placements", PermissionFlagsBits.ManageGuild, false, false, 3000,
	/** End the Company's current season and start a new one */
	async (interaction, database, runMode) => {
		const company = await database.models.Company.findByPk(interaction.guildId);
		if (!company) {
			interaction.reply({ content: "This server hasn't used BountyBot yet, so it doesn't have a season to end.", ephemeral: true });
			return;
		}

		buildCompanyStatsEmbed(interaction.guild, database).then(async embed => {
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
			await database.models.Hunter.update({ rank: null, lastRank: null, nextRankXP: null }, { where: { companyId: company.id } });
			getRankUpdates(interaction.guild, database);
			interaction.reply(company.sendAnnouncement({ content: "A new season has started, ranks and placements have been reset!", embeds: [embed] }));
		})
	}
);
