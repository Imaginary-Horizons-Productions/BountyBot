const fs = require('fs');
const { commandSets } = require('../commands/_commandDictionary.js');
const { CommandWrapper } = require('../classes/InteractionWrapper.js');
const { SlashCommandSubcommandBuilder } = require('discord.js');

let text = "";

commandSets.forEach(commandSet => {
	text += `## ${commandSet.name}\n${commandSet.description}\n`;
	commandSet.fileNames.forEach(filename => {
		/** @type {CommandWrapper} */
		const command = require(`./../commands/${filename}`);
		text += `### /${command.customId}\n> Cooldown: ${command.cooldown / 1000} second(s)\n\n${command.description}\n`;
		for (const optionData of command.data.options) {
			let optionName = "#### ";
			if (optionData instanceof SlashCommandSubcommandBuilder) {
				optionName += `/${command.customId} ${optionData.name}\n`;
			} else {
				optionName += `${optionData.name}${optionData.required ? "" : " (optional)"}\n`;
			}
			text += optionName;
			if (optionData.choices?.length > 0) {
				text += `> Choices: \`${optionData.choices.map(choice => choice.name).join("`, `")}\`\n\n`;
			}
			text += `${optionData.description}\n`;
		}
	})
})

fs.writeFile('wiki/Commands.md', text, (error) => {
	if (error) {
		console.error(error);
	}
});
