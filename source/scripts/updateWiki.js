const fs = require('fs');
const { commandSets } = require('../commands/_commandDictionary.js');
const { CommandWrapper } = require('../classes/InteractionWrapper.js');

let text = "";

commandSets.forEach(commandSet => {
	text += `## ${commandSet.name}\n${commandSet.description}\n`;
	commandSet.fileNames.forEach(filename => {
		/** @type {CommandWrapper} */
		const command = require(`./../commands/${filename}`);
		text += `### /${command.customId}\n> Cooldown: ${command.cooldown / 1000} second(s)\n\n${command.description}\n`;
		for (const optionData of command.data.options) {
			text += `#### ${optionData.name}${optionData.required ? "" : " (optional)"}\n`;
			if (optionData.choices?.length > 0) {
				text += `> Choices: ${optionData.choices.map(choice => choice.name).join(", ")}\n`;
			}
			text += `\n${optionData.description}\n`;
		}
	})
})

fs.writeFile('wiki/Commands.md', text, (error) => {
	if (error) {
		console.error(error);
	}
});
