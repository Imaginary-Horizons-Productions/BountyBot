const { EmbedBuilder, Colors, InteractionContextType, MessageFlags } = require('discord.js');
const { Hunter } = require('../models/users/Hunter');
const { buildCompanyStatsEmbed, randomFooterTip, ihpAuthorPayload } = require('../util/embedUtil');
const { generateTextBar } = require('../util/textUtil');
const { UserContextMenuWrapper } = require('../classes');
const { Op } = require('sequelize');
const { findOneHunter } = require('../logic/hunters');
const { findOrCreateCurrentSeason } = require('../logic/seasons');

const mainId = "BountyBot Stats";
module.exports = new UserContextMenuWrapper(mainId, null, false, [InteractionContextType.Guild], 3000,
	/** Specs */
	(interaction, database, runMode) => {
		const target = interaction.targetMember;
		if (target.id == interaction.client.user.id) {
			// BountyBot
			buildCompanyStatsEmbed(interaction.guild, database).then(embed => {
				interaction.reply({
					embeds: [embed],
					flags: [MessageFlags.Ephemeral]
				});
			})
		} else {
			// Other Hunter
			findOneHunter(target.id, interaction.guild.id).then(async hunter => {
				if (!hunter) {
					interaction.reply({ content: "The specified user doesn't seem to have a profile with this server's BountyBot yet. It'll be created when they gain XP.", flags: [MessageFlags.Ephemeral] });
					return;
				}

				const { xpCoefficient } = await database.models.Company.findByPk(interaction.guildId);
				const currentLevelThreshold = Hunter.xpThreshold(hunter.level, xpCoefficient);
				const nextLevelThreshold = Hunter.xpThreshold(hunter.level + 1, xpCoefficient);
				const participations = await database.models.Participation.findAll({ where: { userId: hunter.userId, companyId: hunter.companyId }, order: [["createdAt", "DESC"]] });
				const [currentSeason] = findOrCreateCurrentSeason(interaction.guildId);
				const currentParticipation = participations.find(participation => participation.seasonId === currentSeason.id);
				const previousParticipations = currentParticipation === null ? participations : participations.slice(1);
				const ranks = await database.models.Rank.findAll({ where: { companyId: interaction.guildId }, order: [["varianceThreshold", "DESC"]] });
				const rankName = ranks[hunter.rank]?.roleId ? `<@&${ranks[hunter.rank].roleId}>` : `Rank ${hunter.rank + 1}`;
				const mostSecondedToast = await database.models.Toast.findOne({ where: { senderId: target.id, companyId: interaction.guildId, secondings: { [Op.gt]: 0 } }, order: [["secondings", "DESC"]] })

				interaction.reply({
					embeds: [
						new EmbedBuilder().setColor(Colors[hunter.profileColor])
							.setAuthor(ihpAuthorPayload)
							.setThumbnail(target.user.avatarURL())
							.setTitle(`${target.displayName} is __Level ${hunter.level}__`)
							.setDescription(`${generateTextBar(hunter.xp - currentLevelThreshold, nextLevelThreshold - currentLevelThreshold, 11)}\nThey have earned *${currentParticipation?.xp ?? 0} XP* this season${hunter.rank !== null ? ` which qualifies for ${rankName}` : ""}.`)
							.addFields(
								{ name: "Season Placements", value: `Currently: ${(currentParticipation?.placement ?? 0) === 0 ? "Unranked" : "#" + currentParticipation.placement}\n${previousParticipations.length > 0 ? `Previous Placements: ${previousParticipations.map(participation => `#${participation.placement}`).join(", ")}` : ""}`, inline: true },
								{ name: "Total XP Earned", value: `${hunter.xp} XP`, inline: true },
								{ name: "Most Seconded Toast", value: mostSecondedToast ? `"${mostSecondedToast.text}" with **${mostSecondedToast.secondings} secondings**` : "No toasts seconded yet..." },
								{ name: "Bounty Stats", value: `Bounties Hunted: ${hunter.othersFinished} bount${hunter.othersFinished === 1 ? 'y' : 'ies'}\nBounty Postings: ${hunter.mineFinished} bount${hunter.mineFinished === 1 ? 'y' : 'ies'}`, inline: true },
								{ name: "Toast Stats", value: `Toasts Raised: ${hunter.toastsRaised} toast${hunter.toastsRaised === 1 ? "" : "s"}\nToasts Seconded: ${hunter.toastsSeconded} toast${hunter.toastsSeconded === 1 ? "" : "s"}\nToasts Recieved: ${hunter.toastsReceived} toast${hunter.toastsReceived === 1 ? "" : "s"}`, inline: true },
							)
							.setFooter(randomFooterTip())
							.setTimestamp()
					],
					flags: [MessageFlags.Ephemeral]
				});
			})
		}
	}
);
