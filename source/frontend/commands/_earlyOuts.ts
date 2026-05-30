import { ChatInputCommandInteraction, GuildMember, MessageFlags } from "discord.js";
import { Bounty, Hunter } from "../../database/models";
import { LogicLayer } from "../../shared/types";
import { InteractionTheater } from "../classes";
import { commandMention } from "../shared";

export function ensureUserFromSlashOptionHasBountyHunter(optionName: string, next: (interaction: ChatInputCommandInteraction, origin: InteractionTheater, isDevMode: boolean, logicLayer: LogicLayer, entities: { member: GuildMember; hunter: Hunter; }) => Promise<void>) {
	return async (interaction: ChatInputCommandInteraction, theater: InteractionTheater, isDevMode: boolean, logicLayer: LogicLayer) => {
		const member = interaction.options.getMember(optionName);
		if (member === null) {
			throw new Error(`\`member\` unexpectedly null`);
		}
		const hunter = member.id === theater.hunter.userId ? theater.hunter : await logicLayer.hunters.findOneHunter(member.id, interaction.guild.id);
		if (!hunter) {
			interaction.reply({ content: `${member} has not interacted with BountyBot on this server.`, flags: MessageFlags.Ephemeral });
			return;
		}
		next(interaction, theater, isDevMode, logicLayer, { member, hunter });
	}
}

export function ensureNumberFromSlashOptionIsGreaterThanOne(optionName: string, next: (interaction: ChatInputCommandInteraction, origin: InteractionTheater, isDevMode: boolean, logicLayer: LogicLayer, input: number) => Promise<void>) {
	return async (interaction: ChatInputCommandInteraction, theater: InteractionTheater, isDevMode: boolean, logicLayer: LogicLayer) => {
		const input = interaction.options.getNumber(optionName);
		if (input === null || input <= 1) {
			interaction.reply({ content: `The value provided for ${optionName} must be greater than 1.`, flags: MessageFlags.Ephemeral })
			return;
		}
		next(interaction, theater, isDevMode, logicLayer, input);
	}
}

export function ensureCompanyHasEnoughOpenEvergreenBounties(countThreshold: number, next: (interaction: ChatInputCommandInteraction, origin: InteractionTheater, isDevMode: boolean, logicLayer: LogicLayer, bounties: Bounty[]) => Promise<void>) {
	return async (interaction: ChatInputCommandInteraction, theater: InteractionTheater, isDevMode: boolean, logicLayer: LogicLayer) => {
		const evergreenBounties = await logicLayer.bounties.findEvergreenBounties(interaction.guild.id);
		if (evergreenBounties.length < countThreshold) {
			let content = countThreshold === 1 ?
				"This server doesn't appear to have any evergreen bounties." :
				"This server must have at least 2 evergreen bounties to be able to swap rewards.";
			interaction.reply({ content, flags: MessageFlags.Ephemeral });
			return;
		}
		next(interaction, theater, isDevMode, logicLayer, evergreenBounties);
	}
}

export function ensureHunterHasOpenBounty(next: (interaction: ChatInputCommandInteraction, origin: InteractionTheater, isDevMode: boolean, logicLayer: LogicLayer, bounties: Bounty[]) => Promise<void>) {
	return async (interaction: ChatInputCommandInteraction, theater: InteractionTheater, isDevMode: boolean, logicLayer: LogicLayer) => {
		const bounties = await logicLayer.bounties.findOpenBounties(theater.user.id, theater.company.id);
		if (bounties.length < 1) {
			interaction.reply({ content: `You don't appear to have any open bounties on this server. Post one with ${commandMention("bounty post")}?`, flags: MessageFlags.Ephemeral });
			return;
		}
		next(interaction, theater, isDevMode, logicLayer, bounties);
	}
}
