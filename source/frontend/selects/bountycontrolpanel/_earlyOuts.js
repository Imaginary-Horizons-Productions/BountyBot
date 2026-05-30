const { MessageFlags, ChatInputCommandInteraction } = require("discord.js");
const { Bounty } = require("../../../database/models");
const { InteractionOrigin } = require("../../classes");

/** @param {(interaction: ChatInputCommandInteraction, origin: InteractionOrigin, runMode: import("../../../shared/types.js").RunModeKindMember, logicLayer: typeof import("../../../logic/index.js"), args: [bounty: Bounty]) => Promise<void>} next */
function ensureBountyExistsAndInteractorIsPoster(next) {
	/**
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {InteractionOrigin} origin
	 * @param {import("../../../shared/types.js").RunModeKindMember} runMode
	 * @param {typeof import("../../../logic/index.js")} logicLayer
	 * @param {[bountyId: string]} args
	 */
	return async (interaction, origin, runMode, logicLayer, [bountyId]) => {
		const bounty = await logicLayer.bounties.findBounty(bountyId);
		if (!bounty) {
			interaction.reply({ content: "This bounty appears to no longer exist. Has this bounty already been completed?", flags: MessageFlags.Ephemeral })
			return;
		}
		if (bounty.userId !== interaction.user.id) {
			interaction.reply({ content: "Only the bounty's poster can use these commands.", flags: MessageFlags.Ephemeral });
			return;
		}
		next(interaction, origin, runMode, logicLayer, [bounty]);
	}
}

module.exports = {
	ensureBountyExistsAndInteractorIsPoster
}
