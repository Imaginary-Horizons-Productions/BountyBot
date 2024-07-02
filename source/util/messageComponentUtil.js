const { Bounty } = require("../models/bounties/Bounty");
const { getNumberEmoji, trimForSelectOptionDescription } = require("./textUtil");

/** @param {Bounty[]} bounties */
function bountiesToSelectOptions(bounties) {
	return bounties.map(bounty => {
		const optionPayload = {
			emoji: getNumberEmoji(bounty.slotNumber),
			label: bounty.title,
			value: bounty.id
		}
		if (bounty.description) {
			optionPayload.description = trimForSelectOptionDescription(bounty.description);
		}
		return optionPayload;
	}).slice(0, 25);
}

module.exports = {
	bountiesToSelectOptions
};
