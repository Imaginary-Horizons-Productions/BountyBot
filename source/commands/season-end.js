const { PermissionFlagsBits } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { buildCompanyStatsEmbed, updateScoreboard } = require('../util/embedUtil');

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
			const ranks = await database.models.Rank.findAll({ where: { companyId: interaction.guild.id }, order: [["varianceThreshold", "DESC"]] });
			const roleIds = ranks.filter(rank => rank.roleId != "").map(rank => rank.roleId);
			if (roleIds.length > 0) {
				const allHunters = await database.models.Hunter.findAll({ where: { companyId: interaction.guildId } });
				interaction.guild.members.fetch({ user: allHunters.map(hunter => hunter.userId) }).then(memberCollection => {
					for (const member of memberCollection.values()) {
						if (member.manageable) {
							member.roles.remove(roleIds);
						}
					}
				})
			}
			await database.models.Hunter.update({ rank: null, nextRankXP: null }, { where: { companyId: company.id } });
			updateScoreboard(company, interaction.guild, database);
			interaction.reply(company.sendAnnouncement({ content: "A new season has started, ranks and placements have been reset!", embeds: [embed] }));
		})
	}
);
