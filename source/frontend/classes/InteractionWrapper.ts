import { ApplicationCommandType, ContextMenuCommandBuilder, InteractionContextType, MessageContextMenuCommandInteraction, PermissionFlags, Snowflake, UserContextMenuCommandInteraction } from "discord.js";

import { AnyInteraction } from "@sapphire/discord.js-utilities";
import { Company, Hunter, User } from "../../database/models";
import { MAX_SET_TIMEOUT } from "../../shared/constants.ts";
import { MemberOf } from "../../shared/types.js";
import { BuildError } from "./BuildError.js";

export class InteractionOrigin {
	company: Company;
	user: User;
	hunter: Hunter;
}

type AnyFlowExecuteFunction =
	| ((interaction: AnyInteraction, origin: InteractionOrigin, args: string[]) => void)
	| UserContextMenuExecuteFunction
	| MessageContextMenuExecuteFunction;

export class InteractionWrapper {
	declare mainId: string;
	declare cooldown: number;

	/** IHP wrapper for interaction responses */
	constructor(mainIdInput: string, cooldownInMS: number, executeFunction: AnyFlowExecuteFunction) {
		if (cooldownInMS > MAX_SET_TIMEOUT) {
			throw new BuildError("InteractionWrapper recieved cooldown argument in excess of MAX_SET_TIMEOUT");
		}
		this.mainId = mainIdInput;
		this.cooldown = cooldownInMS;
		this.execute = executeFunction;
	}

	setLogicLinker(setLogicFunction: (logicBlob: typeof import("../../logic/index.js")) => void) {
		this.setLogic = setLogicFunction;
		return this;
	}

	/** returns Unix Timestamp when cooldown will expire or null in case of expired or missing cooldown */
	getCooldownTimestamp(userId: Snowflake, cooldownMap: Map<string, Map<string, number>>) {
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

export class ContextMenuWrapper extends InteractionWrapper {
	declare execute: (interaction: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction, origin: InteractionOrigin, isDevMode: boolean) => void;
	declare isPremium: boolean;
	declare builder: ContextMenuCommandBuilder;

	/** Wrapper properties for general context menus. Intended to be the basis for the two child types. */
	constructor(mainIdInput: string, defaultMemberPermission: MemberOf<PermissionFlags> | null, isPremiumFlow: boolean, contextEnums: InteractionContextType[], cooldownInMS: number, executeFunction: UserContextMenuExecuteFunction | MessageContextMenuExecuteFunction) {
		super(mainIdInput, cooldownInMS, executeFunction);
		this.isPremium = isPremiumFlow;
		this.builder = new ContextMenuCommandBuilder()
			.setName(mainIdInput)
			.setContexts(contextEnums);
		if (defaultMemberPermission) {
			this.builder.setDefaultMemberPermissions(defaultMemberPermission);
		}
	}
};

type UserContextMenuExecuteFunction = ((interaction: UserContextMenuCommandInteraction, origin: InteractionOrigin, isDevMode: boolean) => void);

export class UserContextMenuWrapper extends ContextMenuWrapper {
	/** Wrapper properties for context menus on users. */
	constructor(mainIdInput: string, defaultMemberPermission: MemberOf<PermissionFlags> | null, isPremiumCommand: boolean, contextEnums: InteractionContextType[], cooldownInMS: number, executeFunction: UserContextMenuExecuteFunction) {
		super(mainIdInput, defaultMemberPermission, isPremiumCommand, contextEnums, cooldownInMS, executeFunction);
		this.builder = this.builder.setType(ApplicationCommandType.User);
	}
};

type MessageContextMenuExecuteFunction = ((interaction: MessageContextMenuCommandInteraction, origin: InteractionOrigin, isDevMode: boolean) => void);

export class MessageContextMenuWrapper extends ContextMenuWrapper {
	/** Wrapper properties for context menus on messages. */
	constructor(mainIdInput: string, defaultMemberPermission: MemberOf<PermissionFlags> | null, isPremiumCommand: boolean, contextEnums: InteractionContextType[], cooldownInMS: number, executeFunction: MessageContextMenuExecuteFunction) {
		super(mainIdInput, defaultMemberPermission, isPremiumCommand, contextEnums, cooldownInMS, executeFunction);
		this.builder = this.builder.setType(ApplicationCommandType.Message);
	}
};
