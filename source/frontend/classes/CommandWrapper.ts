import { ChatInputCommandInteraction, InteractionContextType, SlashCommandBuilder, type PermissionFlags } from "discord.js";
import { MemberOf, RunModeKindMember } from "../../shared/types";
import { BuildError } from "./BuildError.js";
import { InteractionWrapper, type InteractionOrigin } from "./InteractionWrapper.js";

export class CommandWrapper extends InteractionWrapper {
	declare premiumCommand: boolean;
	declare autocomplete?: Record<string, { name: string; value: string; }[]>;
	declare builder: SlashCommandBuilder;

	/** Additional wrapper properties for command parsing */
	constructor(mainIdInput: string, descriptionInput: string, defaultMemberPermission: MemberOf<PermissionFlags> | null, isPremiumCommand: boolean, contextEnums: InteractionContextType[], cooldownInMS: number, executeFunction: (interaction: ChatInputCommandInteraction, origin: InteractionOrigin, runMode: RunModeKindMember) => void) {
		super(mainIdInput, cooldownInMS, executeFunction);
		this.premiumCommand = isPremiumCommand;
		this.autocomplete = {};
		this.builder = new SlashCommandBuilder()
			.setName(mainIdInput)
			.setDescription(descriptionInput)
			.setContexts(contextEnums);
		if (defaultMemberPermission) {
			this.builder.setDefaultMemberPermissions(defaultMemberPermission);
		}
	}

	/** @param {...{type: "Attachment" | "Boolean" | "Channel" | "Integer" | "Mentionable" | "Number" | "Role" | "String" | "User", name: string, description: string, required: boolean, autocomplete?: {name: string, value: string}[], choices?: { name: string, value }[]}} optionsInput */
	setOptions(...optionsInput) {
		optionsInput.forEach(option => {
			this.builder[`add${option.type}Option`](built => {
				built.setName(option.name).setDescription(option.description).setRequired(option.required);
				if (option.autocomplete?.length > 0) {
					if (option.name in this.autocomplete) {
						throw new BuildError(`duplicate autocomplete key (${option.name})`);
					}
					built.setAutocomplete(true);
					this.autocomplete[option.name] = option.autocomplete;
				} else if (option.choices?.length > 0) {
					built.addChoices(...option.choices);
				}
				return built;
			})
		})
		return this;
	}

	/** @param {{name: string, description: string, optionsInput?: {type: "Attachment" | "Boolean" | "Channel" | "Integer" | "Mentionable" | "Number" | "Role" | "String" | "User", name: string, description: string, required: boolean, autocomplete?: {name: string, value: string}[], choices?: { name: string, value }[]}}[]} subcommandsInput */
	setSubcommands(subcommandsInput) {
		subcommandsInput.forEach(subcommand => {
			this.builder.addSubcommand(built => {
				built.setName(subcommand.name).setDescription(subcommand.description);
				if ("optionsInput" in subcommand) {
					subcommand.optionsInput.forEach(option => {
						built[`add${option.type}Option`](subBuilt => {
							subBuilt.setName(option.name).setDescription(option.description).setRequired(option.required);
							if (option.autocomplete?.length > 0) {
								if (option.name in this.autocomplete) {
									throw new BuildError(`duplicate autocomplete key (${option.name})`);
								}
								subBuilt.setAutocomplete(true);
								this.autocomplete[option.name] = option.autocomplete;
							} else if (option.choices?.length > 0) {
								subBuilt.addChoices(...option.choices);
							}
							return subBuilt;
						})
					})
				}
				return built;
			})
		})
		return this;
	}
};

export class SubcommandWrapper {
	/**
	 * @param {string} nameInput
	 * @param {string} descriptionInput
	 * @param {(interaction: ChatInputCommandInteraction, origin: InteractionOrigin, runMode: RunModeKindMember, logicLayer: typeof import("../../logic/index.js")) => Promise<void>} executeFunction
	 */
	constructor(nameInput, descriptionInput, executeFunction) {
		this.data = {
			name: nameInput,
			description: descriptionInput,
		};
		this.executeSubcommand = executeFunction;
	}

	/** @param  {...{ type: "Attachment" | "Boolean" | "Channel" | "Integer" | "Mentionable" | "Number" | "Role" | "String" | "User", name: string, description: string, required: boolean, autocomplete?: { name: string, value: string }[], choices?: { name: string, value: string }[] } } options */
	setOptions(...options) {
		this.data.optionsInput = options;
		return this;
	}
}
