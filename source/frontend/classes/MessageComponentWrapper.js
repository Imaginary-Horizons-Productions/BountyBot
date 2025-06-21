const { ButtonInteraction, AnySelectMenuInteraction } = require("discord.js");
const { InteractionWrapper, InteractionOrigin } = require("./InteractionWrapper.js");

class MessageComponentWrapper extends InteractionWrapper {
	/** IHP parent wrapper for buttons and selects
	 * @param {string} mainIdInput
	 * @param {number} cooldownInMS
	 * @param {(interaction: ButtonInteraction | AnySelectMenuInteraction, origin: InteractionOrigin, runMode: "development" | "test" | "production", ...args: string[]) => void} executeFunction
	 */
	constructor(mainIdInput, cooldownInMS, executeFunction) {
		super(mainIdInput, cooldownInMS, executeFunction);
		/** @type {(interaction: ButtonInteraction | AnySelectMenuInteraction, runMode: "development" | "test" | "production", ...args: string[]) => void} */
		this.execute;
	}
};

class ButtonWrapper extends MessageComponentWrapper {
	/** IHP wrapper for button responses
	 * @param {string} mainIdInput
	 * @param {number} cooldownInMS
	 * @param {(interaction: ButtonInteraction, origin: InteractionOrigin, runMode: "development" | "test" | "production", ...args: string[]) => void} executeFunction
	 */
	constructor(mainIdInput, cooldownInMS, executeFunction) {
		super(mainIdInput, cooldownInMS, executeFunction);
	}
};

class SelectWrapper extends MessageComponentWrapper {
	/** IHP wrapper for any select responses
	 * @param {string} mainIdInput
	 * @param {number} cooldownInMS
	 * @param {(interaction: AnySelectMenuInteraction, origin: InteractionOrigin, runMode: "development" | "test" | "production", ...args: string[]) => void} executeFunction
	 */
	constructor(mainIdInput, cooldownInMS, executeFunction) {
		super(mainIdInput, cooldownInMS, executeFunction);
	}
};

module.exports = { MessageComponentWrapper, ButtonWrapper, SelectWrapper };
