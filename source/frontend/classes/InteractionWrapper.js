const { MAX_SET_TIMEOUT } = require("../../constants.js");
const { Interaction, PermissionFlagsBits, InteractionContextType, ContextMenuCommandBuilder, ApplicationCommandType, ContextMenuCommandInteraction, UserContextMenuCommandInteraction, MessageContextMenuCommandInteraction } = require("discord.js");
const { BuildError } = require("./BuildError.js");
const { Company, User, Hunter } = require("../../database/models");

class InteractionOrigin {
	/** @type {Company} */
	company;
	/** @type {User} */
	user;
	/** @type {Hunter} */
	hunter;
}

class InteractionWrapper {
	/** IHP wrapper for interaction responses
	 * @param {string} mainIdInput
	 * @param {number} cooldownInMS
	 * @param {(interaction: Interaction, origin: InteractionOrigin, args: string[]) => void} executeFunction
	*/
	constructor(mainIdInput, cooldownInMS, executeFunction) {
		if (cooldownInMS > MAX_SET_TIMEOUT) {
			throw new BuildError("InteractionWrapper recieved cooldown argument in excess of MAX_SET_TIMEOUT");
		}
		this.mainId = mainIdInput;
		this.cooldown = cooldownInMS;
		this.execute = executeFunction;
	}

	/** @param {(logicBlob: typeof import("../../logic/index.js")) => void} setLogicFunction */
	setLogicLinker(setLogicFunction) {
		this.setLogic = setLogicFunction;
		return this;
	}

	/** returns Unix Timestamp when cooldown will expire or null in case of expired or missing cooldown
	 * @param {string} userId
	 * @param {Map<string, Map<string, number>>} cooldownMap
	 */
	getCooldownTimestamp(userId, cooldownMap) {
		const now = Date.now();

		if (!cooldownMap.has(this.mainId)) {
			cooldownMap.set(this.mainId, new Map());
		}

		const timestamps = cooldownMap.get(this.mainId);
		if (timestamps.has(userId)) {
			const expirationTime = timestamps.get(userId) + this.cooldown;

			if (now < expirationTime) {
				return Math.round(expirationTime / 1000);
			} else {
				timestamps.delete(userId);
			}
		} else {
			timestamps.set(userId, now);
			setTimeout(() => timestamps.delete(userId), this.cooldown);
		}
		return null;
	}
};

class ContextMenuWrapper extends InteractionWrapper {
	/** Wrapper properties for general context menus. Intended to be the basis for the two child types.
	 * @param {string} mainIdInput
	 * @param {string} descriptionInput
	 * @param {PermissionFlagsBits | null} defaultMemberPermission
	 * @param {boolean} isPremiumCommand
	 * @param {InteractionContextType[]} contextEnums
	 * @param {number} cooldownInMS
	 * @param {(interaction: ContextMenuCommandInteraction, origin: InteractionOrigin, runMode: "development" | "test" | "production") => void} executeFunction
	 */
	constructor(mainIdInput, defaultMemberPermission, isPremiumCommand, contextEnums, cooldownInMS, executeFunction) {
		super(mainIdInput, cooldownInMS, executeFunction);
		this.premiumCommand = isPremiumCommand;
		this.builder = new ContextMenuCommandBuilder()
			.setName(mainIdInput)
			.setContexts(contextEnums);
		if (defaultMemberPermission) {
			this.builder.setDefaultMemberPermissions(defaultMemberPermission);
		}
	}
};

class UserContextMenuWrapper extends ContextMenuWrapper {
	/** Wrapper properties for context menus on users.
	 * @param {string} mainIdInput
	 * @param {string} descriptionInput
	 * @param {PermissionFlagsBits | null} defaultMemberPermission
	 * @param {boolean} isPremiumCommand
	 * @param {InteractionContextType[]} contextEnums
	 * @param {number} cooldownInMS
	 * @param {(interaction: UserContextMenuCommandInteraction, origin: InteractionOrigin, runMode: "development" | "test" | "production") => void} executeFunction
	 */
	constructor(mainIdInput, defaultMemberPermission, isPremiumCommand, contextEnums, cooldownInMS, executeFunction) {
		super(mainIdInput, defaultMemberPermission, isPremiumCommand, contextEnums, cooldownInMS, executeFunction);
		this.builder = this.builder.setType(ApplicationCommandType.User);
	}
};

class MessageContextMenuWrapper extends ContextMenuWrapper {
	/** Wrapper properties for context menus on messages.
	 * @param {string} mainIdInput
	 * @param {string} descriptionInput
	 * @param {PermissionFlagsBits | null} defaultMemberPermission
	 * @param {boolean} isPremiumCommand
	 * @param {InteractionContextType[]} contextEnums
	 * @param {number} cooldownInMS
	 * @param {(interaction: MessageContextMenuCommandInteraction, origin: InteractionOrigin, runMode: "development" | "test" | "production") => void} executeFunction
	 */
	constructor(mainIdInput, defaultMemberPermission, isPremiumCommand, contextEnums, cooldownInMS, executeFunction) {
		super(mainIdInput, defaultMemberPermission, isPremiumCommand, contextEnums, cooldownInMS, executeFunction);
		this.builder = this.builder.setType(ApplicationCommandType.User);
	}
};

module.exports = { InteractionOrigin, InteractionWrapper, ContextMenuWrapper, UserContextMenuWrapper, MessageContextMenuWrapper };
