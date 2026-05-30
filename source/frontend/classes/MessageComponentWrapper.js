const { ButtonInteraction, AnySelectMenuInteraction } = require("discord.js");
const { InteractionWrapper, InteractionOrigin } = require("./InteractionWrapper.js");
const { BuildError } = require("./BuildError.js");

class MessageComponentWrapper extends InteractionWrapper {
	/** IHP parent wrapper for buttons and selects
	 * @param {string} mainIdInput
	 * @param {number} cooldownInMS
	 * @param {(interaction: ButtonInteraction | AnySelectMenuInteraction, origin: InteractionOrigin, runMode: import("../../shared/types.js").RunModeKindMember, ...args: string[]) => void} executeFunction
	 */
	constructor(mainIdInput, cooldownInMS, executeFunction) {
		super(mainIdInput, cooldownInMS, executeFunction);
		/** @type {(interaction: ButtonInteraction | AnySelectMenuInteraction, runMode: import("../../shared/types.js").RunModeKindMember, ...args: string[]) => void} */
		this.execute;
	}
};

class ButtonWrapper extends MessageComponentWrapper {
	/** IHP wrapper for button responses
	 * @param {string} mainIdInput
	 * @param {number} cooldownInMS
	 * @param {(interaction: ButtonInteraction, origin: InteractionOrigin, runMode: import("../../shared/types.js").RunModeKindMember, ...args: string[]) => void} executeFunction
	 */
	constructor(mainIdInput, cooldownInMS, executeFunction) {
		super(mainIdInput, cooldownInMS, executeFunction);
	}
};

class SelectWrapper extends MessageComponentWrapper {
	/** IHP wrapper for any select responses
	 * @param {string} mainIdInput
	 * @param {number} cooldownInMS
	 * @param {(interaction: AnySelectMenuInteraction, origin: InteractionOrigin, runMode: import("../../shared/types.js").RunModeKindMember, ...args: string[]) => void} executeFunction
	 */
	constructor(mainIdInput, cooldownInMS, executeFunction) {
		super(mainIdInput, cooldownInMS, executeFunction);
	}
};

class SelectOptionWrapper {
	/**
	 * @param {string} nameInput
	 * @param {(interaction: ChatInputCommandInteraction, origin: InteractionOrigin, runMode: import("../../shared/types.js").RunModeKindMember, logicLayer: typeof import("../../logic/index.js"), args: unknown[]) => Promise<void>} executeFunction
	 */
	constructor(nameInput, executeFunction) {
		if (!nameInput) {
			throw new BuildError("missing select option name");
		}
		if (!executeFunction) {
			throw new BuildError(`missing execute function for select option: ${this.name}`);
		}
		this.name = nameInput;
		this.execute = executeFunction;
	}
}

module.exports = { MessageComponentWrapper, ButtonWrapper, SelectWrapper, SelectOptionWrapper };
