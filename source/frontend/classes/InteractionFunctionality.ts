import type { AnySelectMenuInteraction, ApplicationCommandOptionChoiceData, PermissionFlags, Snowflake } from "discord.js";
import { ApplicationCommandOptionType, ApplicationCommandType, ButtonInteraction, ChatInputCommandInteraction, ContextMenuCommandBuilder, InteractionContextType, MessageContextMenuCommandInteraction, SlashCommandAttachmentOption, SlashCommandBooleanOption, SlashCommandBuilder, SlashCommandChannelOption, SlashCommandIntegerOption, SlashCommandMentionableOption, SlashCommandNumberOption, SlashCommandRoleOption, SlashCommandStringOption, SlashCommandSubcommandBuilder, SlashCommandUserOption, UserContextMenuCommandInteraction } from "discord.js";
import type { LogicLayer } from "../../logic/index.ts";
import { MAX_SET_TIMEOUT } from "../../shared/constants.ts";
import type { MemberOf } from "../../shared/types.ts";
import { BuildError } from "./BuildError.ts";
import type { InteractionTheater } from "./InteractionTheater.ts";

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

type CommandProcedure = (interaction: ChatInputCommandInteraction<"cached">, theater: InteractionTheater, isDevMode: boolean) => void;

export type SupportedSlashCommandOptionType =
	| SlashCommandStringOption
	| SlashCommandIntegerOption
	| SlashCommandBooleanOption
	| SlashCommandUserOption
	| SlashCommandChannelOption
	| SlashCommandRoleOption
	| SlashCommandMentionableOption
	| SlashCommandNumberOption
	| SlashCommandAttachmentOption;

type AutocompleteMap = Record<string, ApplicationCommandOptionChoiceData[]>;

export class CommandFunctionality extends InteractionFunctionality {
	declare isPremium: boolean;
	declare autocompleteMap?: AutocompleteMap;
	declare builder: SlashCommandBuilder;
	declare execute: CommandProcedure;

	/** Additional wrapper properties for command parsing */
	constructor(mainIdArgument: string, descriptionArgument: string, defaultMemberPermission: MemberOf<PermissionFlags> | null, isPremiumCommand: boolean, contextEnums: InteractionContextType[], cooldownInMS: number, procedure: CommandProcedure) {
		super(mainIdArgument, cooldownInMS, procedure);
		this.isPremium = isPremiumCommand;
		this.builder = new SlashCommandBuilder()
			.setName(mainIdArgument)
			.setDescription(descriptionArgument)
			.setContexts(contextEnums);
		if (defaultMemberPermission) {
			this.builder.setDefaultMemberPermissions(defaultMemberPermission);
		}
	}

	setOptions(...options: SupportedSlashCommandOptionType[]) {
		for (const option of options) {
			switch (option.type) {
				case ApplicationCommandOptionType.String:
					this.builder.addStringOption(option);
					break;
				case ApplicationCommandOptionType.Integer:
					this.builder.addIntegerOption(option);
					break;
				case ApplicationCommandOptionType.Boolean:
					this.builder.addBooleanOption(option);
					break;
				case ApplicationCommandOptionType.User:
					this.builder.addUserOption(option);
					break;
				case ApplicationCommandOptionType.Channel:
					this.builder.addChannelOption(option);
					break;
				case ApplicationCommandOptionType.Role:
					this.builder.addRoleOption(option);
					break;
				case ApplicationCommandOptionType.Mentionable:
					this.builder.addMentionableOption(option);
					break;
				case ApplicationCommandOptionType.Number:
					this.builder.addNumberOption(option);
					break;
				case ApplicationCommandOptionType.Attachment:
					this.builder.addAttachmentOption(option);
					break;
			}
		}
		return this;
	}

	setAutocompleteMap(optionName: string, choices: ApplicationCommandOptionChoiceData[]) {
		if (!this.autocompleteMap) {
			this.autocompleteMap = { [optionName]: choices };
			return this;
		}
		if (optionName in this.autocompleteMap) {
			throw new BuildError(`Duplicate autocomplete optionName (${optionName})`);
		}
		this.autocompleteMap[optionName] = choices;
		return this;
	}

	setSubcommands(subcommandBuilders: SlashCommandSubcommandBuilder[]) {
		for (const builder of subcommandBuilders) {
			this.builder.addSubcommand(builder);
		}
		return this;
	}
};

export type SubcommandProcedure = (interaction: ChatInputCommandInteraction<"cached">, theater: InteractionTheater, isDevMode: boolean, logicLayer: LogicLayer) => Promise<void>;

export class SubcommandFunctionality { //TODONOW consider builder.addSubcommand instead
	declare procedure: SubcommandProcedure;
	declare builder: SlashCommandSubcommandBuilder;

	constructor(name: string, description: string, procedureArgument: SubcommandProcedure) {
		this.builder = new SlashCommandSubcommandBuilder()
			.setName(name)
			.setDescription(description)
		this.procedure = procedureArgument;
	}

	setOptions(...options: SupportedSlashCommandOptionType[]) {
		for (const option of options) {
			switch (option.type) {
				case ApplicationCommandOptionType.String:
					this.builder.addStringOption(option);
					break;
				case ApplicationCommandOptionType.Integer:
					this.builder.addIntegerOption(option);
					break;
				case ApplicationCommandOptionType.Boolean:
					this.builder.addBooleanOption(option);
					break;
				case ApplicationCommandOptionType.User:
					this.builder.addUserOption(option);
					break;
				case ApplicationCommandOptionType.Channel:
					this.builder.addChannelOption(option);
					break;
				case ApplicationCommandOptionType.Role:
					this.builder.addRoleOption(option);
					break;
				case ApplicationCommandOptionType.Mentionable:
					this.builder.addMentionableOption(option);
					break;
				case ApplicationCommandOptionType.Number:
					this.builder.addNumberOption(option);
					break;
				case ApplicationCommandOptionType.Attachment:
					this.builder.addAttachmentOption(option);
					break;
			}
		}
		return this;
	}
}

type ButtonProcedure = (interaction: ButtonInteraction<"cached">, theater: InteractionTheater, isDevMode: boolean, ...args: string[]) => void;

export class ButtonFunctionality extends InteractionFunctionality {
	declare execute: ButtonProcedure;

	/** IHP wrapper for button responses */
	constructor(mainIdArgument: string, cooldownInMS: number, procedure: ButtonProcedure) {
		super(mainIdArgument, cooldownInMS, procedure);
	}
};

type SelectMenuProcedure = (interaction: AnySelectMenuInteraction<"cached">, theater: InteractionTheater, isDevMode: boolean, ...args: string[]) => void;

export class SelectFunctionality extends InteractionFunctionality {
	declare execute: SelectMenuProcedure;

	/** IHP wrapper for any select responses */
	constructor(mainIdArgument: string, cooldownInMS: number, procedure: SelectMenuProcedure) {
		super(mainIdArgument, cooldownInMS, procedure);
	}
};

export type SelectOptionProcedure<T> = (interaction: AnySelectMenuInteraction<"cached">, theater: InteractionTheater, isDevMode: boolean, logicLayer: LogicLayer, args: T) => Promise<void>;

export class SelectOptionFunctionality<T> {
	declare name: string;
	declare execute: SelectOptionProcedure<T>

	constructor(nameArgument: string, procedure: SelectOptionProcedure<T>) {
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
	declare execute: (interaction: UserContextMenuCommandInteraction<"cached"> | MessageContextMenuCommandInteraction<"cached">, theater: InteractionTheater, isDevMode: boolean) => void;
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

type UserContextMenuProcedure = (interaction: UserContextMenuCommandInteraction<"cached">, theater: InteractionTheater, isDevMode: boolean) => void;

export class UserContextMenuFunctionality extends ContextMenuFunctionality {
	/** Wrapper properties for context menus on users. */
	constructor(mainIdArgument: string, defaultMemberPermission: MemberOf<PermissionFlags> | null, isPremiumCommand: boolean, contextEnums: InteractionContextType[], cooldownInMS: number, procedure: UserContextMenuProcedure) {
		super(mainIdArgument, defaultMemberPermission, isPremiumCommand, contextEnums, cooldownInMS, procedure);
		this.builder = this.builder.setType(ApplicationCommandType.User);
	}
};

type MessageContextMenuProcedure = (interaction: MessageContextMenuCommandInteraction<"cached">, theater: InteractionTheater, isDevMode: boolean) => void;

export class MessageContextMenuFunctionality extends ContextMenuFunctionality {
	/** Wrapper properties for context menus on messages. */
	constructor(mainIdArgument: string, defaultMemberPermission: MemberOf<PermissionFlags> | null, isPremiumCommand: boolean, contextEnums: InteractionContextType[], cooldownInMS: number, procedure: MessageContextMenuProcedure) {
		super(mainIdArgument, defaultMemberPermission, isPremiumCommand, contextEnums, cooldownInMS, procedure);
		this.builder = this.builder.setType(ApplicationCommandType.Message);
	}
};
