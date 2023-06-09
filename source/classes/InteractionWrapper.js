const { SlashCommandBuilder } = require("@discordjs/builders");
const { MAX_SET_TIMEOUT } = require("../constants");

class InteractionWrapper {
	/** IHP wrapper for interaction responses
	 * @param {string} customIdInput
	 * @param {number} cooldownInMS
	 * @param {(interaction: import("discord.js").Interaction, args: string[]) => void} executeFunction
	*/
	constructor(customIdInput, cooldownInMS, executeFunction) {
		if (cooldownInMS > MAX_SET_TIMEOUT) {
			throw new Error("InteractionWrapper recieved cooldown argument in excess of MAX_SET_TIMEOUT");
		}
		this.customId = customIdInput;
		this.cooldown = cooldownInMS;
		this.execute = executeFunction;
	}
};
module.exports.InteractionWrapper = InteractionWrapper;

class CommandWrapper extends module.exports.InteractionWrapper {
	/** Additional wrapper properties for command parsing
	 * @param {string} customIdInput
	 * @param {string} descriptionInput
	 * @param {import("discord.js").PermissionFlags} defaultMemberPermission
	 * @param {boolean} isPremiumCommand
	 * @param {boolean} allowInDMsInput
	 * @param {number} cooldownInMS
	 * @param {{type: "Attachment" | "Boolean" | "Channel" | "Integer" | "Mentionable" | "Number" | "Role" | "String" | "User", name: string, description: string, required: boolean, choices: { name: string, value }[]}[]} optionsInput
	 * @param {{name: string, description: string, optionsInput: {type: "Attachment" | "Boolean" | "Channel" | "Integer" | "Mentionable" | "Number" | "Role" | "String" | "User", name: string, description: string, required: boolean, choices: { name: string, value }[]}}[]} subcommandsInput
	 * @param {(interaction: import("discord.js").Interaction) => void} executeFunction
	 */
	constructor(customIdInput, descriptionInput, defaultMemberPermission, isPremiumCommand, allowInDMsInput, cooldownInMS, optionsInput, subcommandsInput, executeFunction) {
		super(customIdInput, cooldownInMS, executeFunction);
		this.description = descriptionInput;
		this.premiumCommand = isPremiumCommand;
		this.data = new SlashCommandBuilder()
			.setName(customIdInput)
			.setDescription(descriptionInput)
			.setDefaultMemberPermissions(defaultMemberPermission)
			.setDMPermission(allowInDMsInput);
		optionsInput.forEach(option => {
			this.data[`add${option.type}Option`](built => {
				built.setName(option.name).setDescription(option.description).setRequired(option.required);
				if (option.choices === null || option.choices === undefined) {
					throw new Error(`${this.customId} (${descriptionInput}) ${option.type} Option was nullish.`);
				}
				if (option.choices.length) {
					built.addChoices(...option.choices);
				}
				return built;
			})
		})
		subcommandsInput.forEach(subcommand => {
			this.data.addSubcommand(built => {
				built.setName(subcommand.name).setDescription(subcommand.description);
				subcommand.optionsInput.forEach(option => {
					built[`add${option.type}Option`](subBuilt => {
						subBuilt.setName(option.name).setDescription(option.description).setRequired(option.required);
						if (option.choices === null || option.choices === undefined) {
							throw new Error(`${this.customId} (${descriptionInput}) ${option.type} Option was nullish.`);
						}
						let choiceEntries = Object.entries(option.choices);
						if (choiceEntries.length) {
							subBuilt.addChoices(...Object.entries(option.choices));
						}
						return subBuilt;
					})
				})
				return built;
			})
		})
		this.data.setDefaultMemberPermissions()
	}
};
module.exports.CommandWrapper = CommandWrapper;

module.exports.CommandSet = class {
	/** slash command linker
	 * @param {string} nameInput
	 * @param {string} descriptionInput
	 * @param {boolean} cullforNonManagers
	 * @param {string[]} fileNamesInput
	 */
	constructor(nameInput, descriptionInput, cullforNonManagers, fileNamesInput) {
		this.name = nameInput;
		this.description = descriptionInput;
		this.managerCommands = cullforNonManagers;
		this.fileNames = fileNamesInput;
	}
};
