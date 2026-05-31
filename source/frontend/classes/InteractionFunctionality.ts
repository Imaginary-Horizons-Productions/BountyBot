import { AnySelectMenuInteraction, ApplicationCommandType, ButtonInteraction, ChatInputCommandInteraction, ContextMenuCommandBuilder, InteractionContextType, MessageContextMenuCommandInteraction, PermissionFlags, PrimaryEntryPointCommandInteraction, SlashCommandBuilder, Snowflake, UserContextMenuCommandInteraction } from "discord.js";
import { MAX_SET_TIMEOUT } from "../../shared/constants.ts";
import { LogicLayer, MemberOf } from "../../shared/types.ts";
import { BuildError } from "./BuildError.js";
import { InteractionTheater } from "./InteractionTheater.ts";

type InteractionProcedure =
	| CommandProcedure
	| ButtonProcedure
	| SelectMenuProcedure
	| UserContextMenuProcedure
	| MessageContextMenuProcedure;

export class InteractionFunctionality {
	declare mainId: string;
	declare cooldown: number;
	declare execute: InteractionProcedure;
	declare linkToLogic?: (logicLayer: LogicLayer) => void;

	/** IHP wrapper for interaction responses */
	constructor(mainIdArgument: string, cooldownInMS: number, procedure: InteractionProcedure) {
		if (cooldownInMS > MAX_SET_TIMEOUT) {
			throw new BuildError("InteractionFunctionality recieved cooldown argument greater than MAX_SET_TIMEOUT");
		}
		this.mainId = mainIdArgument;
		this.cooldown = cooldownInMS;
		this.execute = procedure;
	}

	setLogicLinker(setLogicFunction: (logicBlob: LogicLayer) => void) {
		this.linkToLogic = setLogicFunction;
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

type CommandProcedure = (interaction: ChatInputCommandInteraction | PrimaryEntryPointCommandInteraction, theater: InteractionTheater, isDevMode: boolean) => void;

export class CommandFunctionality extends InteractionFunctionality {
	declare isPremium: boolean;
	declare autocomplete?: Record<string, { name: string; value: string; }[]>;
	declare builder: SlashCommandBuilder;
	declare execute: CommandProcedure;

	/** Additional wrapper properties for command parsing */
	constructor(mainIdArgument: string, descriptionArgument: string, defaultMemberPermission: MemberOf<PermissionFlags> | null, isPremiumCommand: boolean, contextEnums: InteractionContextType[], cooldownInMS: number, procedure: CommandProcedure) {
		super(mainIdArgument, cooldownInMS, procedure);
		this.isPremium = isPremiumCommand;
		this.autocomplete = {};
		this.builder = new SlashCommandBuilder()
			.setName(mainIdArgument)
			.setDescription(descriptionArgument)
			.setContexts(contextEnums);
		if (defaultMemberPermission) {
			this.builder.setDefaultMemberPermissions(defaultMemberPermission);
		}
	}

	setOptions(...optionArguments: { type: "Attachment" | "Boolean" | "Channel" | "Integer" | "Mentionable" | "Number" | "Role" | "String" | "User", name: string, description: string, required: boolean, autocomplete?: { name: string, value: string }[], choices?: { name: string, value: string }[] }[]) {
		optionArguments.forEach(optionArgument => {
			this.builder[`add${optionArgument.type}Option`](option => {
				option.setName(optionArgument.name).setDescription(optionArgument.description).setRequired(optionArgument.required);
				if (optionArgument.autocomplete?.length > 0) {
					if (optionArgument.name in this.autocomplete) {
						throw new BuildError(`duplicate autocomplete key (${optionArgument.name})`);
					}
					option.setAutocomplete(true);
					this.autocomplete[optionArgument.name] = optionArgument.autocomplete;
				} else if (optionArgument.choices?.length > 0) {
					option.addChoices(...optionArgument.choices);
				}
				return option;
			})
		})
		return this;
	}

	setSubcommands(subcommandArguments: { name: string, description: string, optionArguments?: { type: "Attachment" | "Boolean" | "Channel" | "Integer" | "Mentionable" | "Number" | "Role" | "String" | "User", name: string, description: string, required: boolean, autocomplete?: { name: string, value: string }[], choices?: { name: string, value: string }[] } }[]) {
		subcommandArguments.forEach(subcommandArgument => {
			this.builder.addSubcommand(subcommand => {
				subcommand.setName(subcommandArgument.name).setDescription(subcommandArgument.description);
				if ("optionArguments" in subcommandArgument) {
					subcommandArgument.optionArguments.forEach(optionArgument => {
						subcommand[`add${optionArgument.type}Option`](option => {
							option.setName(optionArgument.name).setDescription(optionArgument.description).setRequired(optionArgument.required);
							if (optionArgument.autocomplete?.length > 0) {
								if (optionArgument.name in this.autocomplete) {
									throw new BuildError(`duplicate autocomplete key (${optionArgument.name})`);
								}
								option.setAutocomplete(true);
								this.autocomplete[optionArgument.name] = optionArgument.autocomplete;
							} else if (optionArgument.choices?.length > 0) {
								option.addChoices(...optionArgument.choices);
							}
							return option;
						})
					})
				}
				return subcommand;
			})
		})
		return this;
	}
};

type SubcommandProcedure = (interaction: ChatInputCommandInteraction, theater: InteractionTheater, isDevMode: boolean, logicLayer: LogicLayer) => Promise<void>;

export class SubcommandFunctionality {
	declare procedure: SubcommandProcedure;

	constructor(name: string, description: string, procedureArgument: SubcommandProcedure) {
		this.data = { name, description };
		this.procedure = procedureArgument;
	}

	setOptions(...options: { type: "Attachment" | "Boolean" | "Channel" | "Integer" | "Mentionable" | "Number" | "Role" | "String" | "User", name: string, description: string, required: boolean, autocomplete?: { name: string, value: string }[], choices?: { name: string, value: string }[] }[]) {
		this.data.optionsInput = options;
		return this;
	}
}

export class MessageComponentFunctionality extends InteractionFunctionality {
	declare execute: ButtonProcedure | SelectMenuProcedure;

	/** IHP parent wrapper for buttons and selects */
	constructor(mainIdArgument: string, cooldownInMS: number, procedure: ButtonProcedure | SelectMenuProcedure) {
		super(mainIdArgument, cooldownInMS, procedure);
	}
};

type ButtonProcedure = (interaction: ButtonInteraction, theater: InteractionTheater, isDevMode: boolean, ...args: string[]) => void;

export class ButtonFunctionality extends MessageComponentFunctionality {
	/** IHP wrapper for button responses */
	constructor(mainIdArgument: string, cooldownInMS: number, procedure: ButtonProcedure) {
		super(mainIdArgument, cooldownInMS, procedure);
	}
};

type SelectMenuProcedure = (interaction: AnySelectMenuInteraction, theater: InteractionTheater, isDevMode: boolean, ...args: string[]) => void;

export class SelectFunctionality extends MessageComponentFunctionality {
	/** IHP wrapper for any select responses */
	constructor(mainIdArgument: string, cooldownInMS: number, procedure: SelectMenuProcedure) {
		super(mainIdArgument, cooldownInMS, procedure);
	}
};

export class SelectOptionFunctionality {
	constructor(nameArgument: string, procedure: (interaction: ChatInputCommandInteraction, theater: InteractionTheater, isDevMode: boolean, logicLayer: LogicLayer, args: unknown[]) => Promise<void>) {
		if (!nameArgument) {
			throw new BuildError("missing select option name");
		}
		if (!procedure) {
			throw new BuildError(`missing procedure for select option: ${nameArgument}`);
		}
		this.name = nameArgument;
		this.execute = procedure;
	}
}

export class ContextMenuFunctionality extends InteractionFunctionality {
	declare execute: (interaction: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction, theater: InteractionTheater, isDevMode: boolean) => void;
	declare isPremium: boolean;
	declare builder: ContextMenuCommandBuilder;

	/** Wrapper properties for general context menus. Intended to be the basis for the two child types. */
	constructor(mainIdArgument: string, defaultMemberPermission: MemberOf<PermissionFlags> | null, isPremiumFlow: boolean, contextEnums: InteractionContextType[], cooldownInMS: number, procedure: UserContextMenuProcedure | MessageContextMenuProcedure) {
		super(mainIdArgument, cooldownInMS, procedure);
		this.isPremium = isPremiumFlow;
		this.builder = new ContextMenuCommandBuilder()
			.setName(mainIdArgument)
			.setContexts(contextEnums);
		if (defaultMemberPermission) {
			this.builder.setDefaultMemberPermissions(defaultMemberPermission);
		}
	}
};

type UserContextMenuProcedure = (interaction: UserContextMenuCommandInteraction, theater: InteractionTheater, isDevMode: boolean) => void;

export class UserContextMenuFunctionality extends ContextMenuFunctionality {
	/** Wrapper properties for context menus on users. */
	constructor(mainIdArgument: string, defaultMemberPermission: MemberOf<PermissionFlags> | null, isPremiumCommand: boolean, contextEnums: InteractionContextType[], cooldownInMS: number, procedure: UserContextMenuProcedure) {
		super(mainIdArgument, defaultMemberPermission, isPremiumCommand, contextEnums, cooldownInMS, procedure);
		this.builder = this.builder.setType(ApplicationCommandType.User);
	}
};

type MessageContextMenuProcedure = (interaction: MessageContextMenuCommandInteraction, theater: InteractionTheater, isDevMode: boolean) => void;

export class MessageContextMenuFunctionality extends ContextMenuFunctionality {
	/** Wrapper properties for context menus on messages. */
	constructor(mainIdArgument: string, defaultMemberPermission: MemberOf<PermissionFlags> | null, isPremiumCommand: boolean, contextEnums: InteractionContextType[], cooldownInMS: number, procedure: MessageContextMenuProcedure) {
		super(mainIdArgument, defaultMemberPermission, isPremiumCommand, contextEnums, cooldownInMS, procedure);
		this.builder = this.builder.setType(ApplicationCommandType.Message);
	}
};
