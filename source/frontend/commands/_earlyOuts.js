const { MessageFlags, ChatInputCommandInteraction, GuildMember } = require("discord.js");
const { commandMention } = require("../shared");
const { InteractionOrigin } = require("../classes");
const { Bounty, Hunter } = require("../../database/models");

/** @param {(interaction: ChatInputCommandInteraction, origin: InteractionOrigin, runMode: "development" | "test" | "production", logicLayer: typeof import("../../logic"), entities: { member: GuildMember; hunter: Hunter; }) => Promise<void>} next */
function ensureUserFromSlashOptionHasBountyHunter(optionName, next) {
	/**
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {InteractionOrigin} origin
	 * @param {"development" | "test" | "production"} runMode
	 * @param {typeof import("../../logic")} logicLayer
	 */
	return async (interaction, origin, runMode, logicLayer) => {
		const member = interaction.options.getMember(optionName);
		const hunter = member.id === origin.hunter.userId ? origin.hunter : await logicLayer.hunters.findOneHunter(member.id, interaction.guild.id);
		if (!hunter) {
			interaction.reply({ content: `${member} has not interacted with BountyBot on this server.`, flags: MessageFlags.Ephemeral });
			return;
		}
		next(interaction, origin, runMode, logicLayer, { member, hunter });
	}
}

/** @param {(interaction: ChatInputCommandInteraction, origin: InteractionOrigin, runMode: "development" | "test" | "production", logicLayer: typeof import("../../logic"), input: number) => Promise<void>} next */
function ensureNumberFromSlashOptionIsGreaterThanOne(optionName, next) {
	/**
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {InteractionOrigin} origin
	 * @param {"development" | "test" | "production"} runMode
	 * @param {typeof import("../../logic")} logicLayer
	 */
	return async (interaction, origin, runMode, logicLayer) => {
		const input = interaction.options.getNumber(optionName);
		if (input <= 1) {
			interaction.reply({ content: `The value provided for ${optionName} must be greater than 1.`, flags: MessageFlags.Ephemeral })
			return;
		}
		next(interaction, origin, runMode, logicLayer, input);
	}
}

/** @param {(interaction: ChatInputCommandInteraction, origin: InteractionOrigin, runMode: "development" | "test" | "production", logicLayer: typeof import("../../logic"), bounties: Bounty[]) => Promise<void>} next */
function ensureCompanyHasEnoughOpenEvergreenBounties(countThreshold, next) {
	/**
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {InteractionOrigin} origin
	 * @param {"development" | "test" | "production"} runMode
	 * @param {typeof import("../../logic")} logicLayer
	 */
	return async (interaction, origin, runMode, logicLayer) => {
		const evergreenBounties = await logicLayer.bounties.findEvergreenBounties(interaction.guild.id);
		if (evergreenBounties.length < countThreshold) {
			let content = countThreshold === 1 ?
				"This server doesn't appear to have any evergreen bounties." :
				"This server must have at least 2 evergreen bounties to be able to swap rewards.";
			interaction.reply({ content, flags: MessageFlags.Ephemeral });
			return;
		}
		next(interaction, origin, runMode, logicLayer, evergreenBounties);
	}
}

/** @param {(interaction: ChatInputCommandInteraction, origin: InteractionOrigin, runMode: "development" | "test" | "production", logicLayer: typeof import("../../logic"), bounties: Bounty[]) => Promise<void>} next */
function ensureHunterHasOpenBounty(next) {
	/**
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {InteractionOrigin} origin
	 * @param {"development" | "test" | "production"} runMode
	 * @param {typeof import("../../logic")} logicLayer
	 */
	return async (interaction, origin, runMode, logicLayer) => {
		const bounties = await logicLayer.bounties.findOpenBounties(origin.user.id, origin.company.id);
		if (bounties.length < 1) {
			interaction.reply({ content: `You don't appear to have any open bounties on this server. Post one with ${commandMention("bounty post")}?`, flags: MessageFlags.Ephemeral });
			return;
		}
		next(interaction, origin, runMode, logicLayer, bounties);
	}
}

module.exports = {
	ensureUserFromSlashOptionHasBountyHunter,
	ensureNumberFromSlashOptionIsGreaterThanOne,
	ensureCompanyHasEnoughOpenEvergreenBounties,
	ensureHunterHasOpenBounty
};
