import { InteractionContextType, MessageFlags } from 'discord.js';

import { Hunter } from '../../database/models';
import { LogicLayer } from "../../shared/types";
import { UserContextMenuFunctionality } from '../classes';
import { companyStatsEmbed, hunterProfileEmbed } from '../shared';

let logicLayer: LogicLayer;

const mainId = "BountyBot Stats";
export default new UserContextMenuFunctionality(mainId, null, false, [InteractionContextType.Guild], 3000,
	async (interaction, theater, isDevMode) => {
		const target = interaction.targetMember;
		const [currentSeason] = await logicLayer.seasons.findOrCreateCurrentSeason(interaction.guildId);
		if (target.id == interaction.client.user.id) {
			// BountyBot
			const hunterMap = await logicLayer.hunters.getCompanyHunterMap(interaction.guild.id);
			const lastSeason = await logicLayer.seasons.findOneSeason(interaction.guild.id, "previous");
			const participantCount = await logicLayer.seasons.getParticipantCount(currentSeason.id);
			companyStatsEmbed(interaction.guild, theater.company.getXP(hunterMap), participantCount, currentSeason, lastSeason).then(embed => {
				interaction.reply({
					embeds: [embed],
					flags: MessageFlags.Ephemeral
				});
			})
		} else {
			// Other Hunter
			logicLayer.hunters.findOneHunter(target.id, interaction.guild.id).then(async hunter => {
				if (!hunter) {
					interaction.reply({ content: "The specified user doesn't seem to have a profile with this server's BountyBot yet. It'll be created when they gain XP.", flags: MessageFlags.Ephemeral });
					return;
				}

				const currentHunterLevel = hunter.getLevel(theater.company.xpCoefficient);
				const currentLevelThreshold = Hunter.xpThreshold(currentHunterLevel, theater.company.xpCoefficient);
				const nextLevelThreshold = Hunter.xpThreshold(currentHunterLevel + 1, theater.company.xpCoefficient);
				const participations = await logicLayer.seasons.findHunterParticipations(hunter.userId, hunter.companyId);
				const currentParticipation = participations.find(participation => participation.seasonId === currentSeason.id);
				const previousParticipations = currentParticipation === null ? participations : participations.slice(1);
				const ranks = await logicLayer.ranks.findAllRanks(interaction.guildId);
				let rankName = null;
				if (currentParticipation && ranks.length > 0) {
					rankName = ranks[currentParticipation.rankIndex].getMention(currentParticipation.rankIndex);
				}
				const mostSecondedToast = await logicLayer.toasts.findMostSecondedToast(target.id, interaction.guild.id);

				interaction.reply({
					embeds: [hunterProfileEmbed(hunter, target, currentHunterLevel, currentLevelThreshold, nextLevelThreshold, currentParticipation, rankName, previousParticipations, mostSecondedToast)],
					flags: MessageFlags.Ephemeral
				});
			})
		}
	}
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
