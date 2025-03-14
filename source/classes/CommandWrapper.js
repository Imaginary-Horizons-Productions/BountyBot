const { PermissionFlagsBits, CommandInteraction, SlashCommandBuilder, InteractionContextType } = require("discord.js");
const { BuildError } = require("./BuildError.js");
const { InteractionWrapper } = require("./InteractionWrapper.js");

class CommandWrapper extends InteractionWrapper {
	/** Additional wrapper properties for command parsing
	 * @param {string} mainIdInput
	 * @param {string} descriptionInput
	 * @param {PermissionFlagsBits | null} defaultMemberPermission
	 * @param {boolean} isPremiumCommand
	 * @param {InteractionContextType[]} contextEnums
	 * @param {number} cooldownInMS
	 * @param {(interaction: CommandInteraction, runMode: "development" | "test" | "production") => void} executeFunction
	 */
	constructor(mainIdInput, descriptionInput, defaultMemberPermission, isPremiumCommand, contextEnums, cooldownInMS, executeFunction) {
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

class SubcommandWrapper {
	/**
	 * @param {string} nameInput
	 * @param {string} descriptionInput
	 * @param {(interaction: CommandInteraction, runMode: string, ...args: [typeof import("../logic/index.js"), unknown]) => Promise<void>} executeFunction
	 */
	constructor(nameInput, descriptionInput, executeFunction) {
		this.data = {
			name: nameInput,
			description: descriptionInput,
		};
		this.executeSubcommand = executeFunction;
	}

	/** @param  {...{ type: "", name: string, description: string, required: boolean, autocomplete?: { name: string, value: string }[], choices?: { name: string, value: string }[] } } options */
	setOptions(...options) {
		this.data.optionsInput = options;
		return this;
	}
}

module.exports = { CommandWrapper, SubcommandWrapper };
