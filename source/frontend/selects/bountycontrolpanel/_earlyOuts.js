const { MessageFlags, ChatInputCommandInteraction } = require("discord.js");
const { InteractionTheater } = require("../../classes");
const { DatabaseTypes } = require("../../../database/index.js");

/** @param {(interaction: ChatInputCommandInteraction, theater: InteractionTheater, isDevMode: boolean, logicLayer: import("../../../logic/index.js").LogicLayer, args: [bounty: DatabaseTypes.Bounty]) => Promise<void>} next */
function ensureBountyExistsAndInteractorIsPoster(next) {
	/**
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {InteractionTheater} theater
	 * @param {boolean} isDevMode
	 * @param {import("../../../logic/index.js").LogicLayer} logicLayer
	 * @param {[bountyId: string]} args
	 */
	return async (interaction, theater, isDevMode, logicLayer, [bountyId]) => {
		const bounty = await logicLayer.bounties.findBounty(bountyId);
		if (!bounty) {
			interaction.reply({ content: "This bounty appears to no longer exist. Has this bounty already been completed?", flags: MessageFlags.Ephemeral })
			return;
		}
		if (bounty.userId !== interaction.user.id) {
			interaction.reply({ content: "Only the bounty's poster can use these commands.", flags: MessageFlags.Ephemeral });
			return;
		}
		next(interaction, theater, isDevMode, logicLayer, [bounty]);
	}
}

module.exports = {
	ensureBountyExistsAndInteractorIsPoster
}
